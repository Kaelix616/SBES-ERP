/*
  sbes.erp – RFID Attendance Reader (ESP32 + RC522)
  Shahbabu Educational Society – Attendance ERP Portal
  Developed by Abdul Wahab

  Libraries (Arduino Library Manager):
    - MFRC522 by GithubCommunity
    - ArduinoJson by Benoit Blanchon (v7)
  Board: "ESP32 Dev Module" (esp32 core by Espressif)
*/
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <time.h>

// ====== EDIT THESE ======
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASS     = "YOUR_WIFI_PASSWORD";
const char* API_KEY       = "FIREBASE_WEB_API_KEY";
const char* PROJECT_ID    = "your-firebase-project-id";
const char* DEVICE_EMAIL  = "device01@sbes.erp";      // Auth user whose users/{uid}.role = "device"
const char* DEVICE_PASS   = "DEVICE_PASSWORD";
const char* DEVICE_ID     = "esp32-01";               // must match web/firebase-config.js
const char* CLASS_ID      = "PASTE_CLASS_DOC_ID";     // Firestore classes/{id} this reader belongs to
// ========================

#define SS_PIN 5
#define RST_PIN 22
#define LED_OK 26
#define LED_ERR 27
#define BUZZER 25

MFRC522 rfid(SS_PIN, RST_PIN);
String idToken = "";
unsigned long tokenTime = 0;
String lastUid = "";
unsigned long lastScan = 0;

String fsBase() {
  return String("https://firestore.googleapis.com/v1/projects/") + PROJECT_ID + "/databases/(default)/documents";
}

void beep(int ms) { digitalWrite(BUZZER, HIGH); delay(ms); digitalWrite(BUZZER, LOW); }
void signalOk()  { digitalWrite(LED_OK, HIGH); beep(120); delay(300); digitalWrite(LED_OK, LOW); }
void signalErr() { digitalWrite(LED_ERR, HIGH); beep(150); delay(100); beep(150); delay(300); digitalWrite(LED_ERR, LOW); }

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(400); Serial.print("."); }
  Serial.println(" connected: " + WiFi.localIP().toString());
}

bool signIn() {
  WiFiClientSecure c; c.setInsecure();   // production: use setCACert() with the Google root CA
  HTTPClient http;
  String url = String("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=") + API_KEY;
  http.begin(c, url);
  http.addHeader("Content-Type", "application/json");
  JsonDocument d;
  d["email"] = DEVICE_EMAIL; d["password"] = DEVICE_PASS; d["returnSecureToken"] = true;
  String body; serializeJson(d, body);
  int code = http.POST(body);
  bool ok = false;
  if (code == 200) {
    JsonDocument r; deserializeJson(r, http.getString());
    idToken = r["idToken"].as<String>();
    tokenTime = millis(); ok = true;
    Serial.println("Signed in to Firebase");
  } else Serial.printf("Sign-in failed: %d\n", code);
  http.end();
  return ok;
}

void ensureToken() {
  if (idToken == "" || millis() - tokenTime > 50UL * 60UL * 1000UL) signIn();   // tokens last 60 min
}

// Generic Firestore REST call. Returns HTTP code; response body goes into 'out'.
int fs(const String& method, const String& path, const String& body, String& out) {
  ensureToken();
  WiFiClientSecure c; c.setInsecure();
  HTTPClient http;
  http.begin(c, fsBase() + path);
  http.addHeader("Authorization", "Bearer " + idToken);
  http.addHeader("Content-Type", "application/json");
  int code = (method == "GET") ? http.GET()
           : (method == "POST") ? http.POST(body)
           : http.sendRequest(method.c_str(), body);
  out = http.getString();
  http.end();
  return code;
}

String isoUtc(time_t t) { struct tm tmv; gmtime_r(&t, &tmv); char b[25]; strftime(b, sizeof b, "%Y-%m-%dT%H:%M:%SZ", &tmv); return String(b); }
String istTime(time_t t) { t += 19800; struct tm tmv; gmtime_r(&t, &tmv); char b[12]; strftime(b, sizeof b, "%H:%M:%S", &tmv); return String(b); }

String readUid() {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) { if (rfid.uid.uidByte[i] < 0x10) uid += "0"; uid += String(rfid.uid.uidByte[i], HEX); }
  uid.toUpperCase();
  return uid;
}

String sv(JsonVariant f, const char* key) { return f[key]["stringValue"] | ""; }

void handleCard(const String& uid) {
  String out;
  // 1) Which student owns this card?
  int code = fs("GET", "/rfidIndex/" + uid, "", out);
  if (code == 404) {
    Serial.println("Unknown card " + uid + " -> sent to dashboard");
    JsonDocument d;
    d["fields"]["lastUid"]["stringValue"] = uid;
    d["fields"]["lastScanAt"]["timestampValue"] = isoUtc(time(nullptr));
    String b; serializeJson(d, b);
    fs("PATCH", String("/devices/") + DEVICE_ID + "?updateMask.fieldPaths=lastUid&updateMask.fieldPaths=lastScanAt", b, out);
    signalErr(); return;
  }
  if (code != 200) { Serial.printf("rfidIndex error %d\n", code); signalErr(); return; }
  JsonDocument idx; deserializeJson(idx, out);
  JsonVariant f = idx["fields"];
  String studentId = sv(f, "studentId"), name = sv(f, "name"), roll = sv(f, "rollNo"), cls = sv(f, "classId");
  if (cls != CLASS_ID) { Serial.println("Student belongs to another class"); signalErr(); return; }

  // 2) Is a session running for this class?
  code = fs("GET", String("/classes/") + CLASS_ID, "", out);
  if (code != 200) { signalErr(); return; }
  JsonDocument cd; deserializeJson(cd, out);
  JsonVariant cf = cd["fields"];
  String sessionId = sv(cf, "activeSessionId"), subjectId = sv(cf, "activeSubjectId"), date = sv(cf, "activeDate");
  if (sessionId == "") { Serial.println("No active session"); signalErr(); return; }

  // 3) Create the attendance doc (409 means it already exists = already marked)
  time_t now = time(nullptr);
  JsonDocument a;
  JsonObject af = a["fields"].to<JsonObject>();
  af["sessionId"]["stringValue"] = sessionId;
  af["classId"]["stringValue"] = CLASS_ID;
  af["subjectId"]["stringValue"] = subjectId;
  af["studentId"]["stringValue"] = studentId;
  af["name"]["stringValue"] = name;
  af["rollNo"]["stringValue"] = roll;
  af["date"]["stringValue"] = date;
  af["time"]["stringValue"] = istTime(now);
  af["status"]["stringValue"] = "present";
  af["source"]["stringValue"] = "rfid";
  af["ts"]["timestampValue"] = isoUtc(now);
  String b; serializeJson(a, b);
  code = fs("POST", "/attendance?documentId=" + sessionId + "_" + studentId, b, out);
  if (code == 200) { Serial.println("PRESENT: " + name + " (" + roll + ")"); signalOk(); }
  else if (code == 409) { Serial.println("Already marked: " + name); beep(60); delay(80); beep(60); }
  else { Serial.printf("Attendance error %d %s\n", code, out.c_str()); signalErr(); }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_OK, OUTPUT); pinMode(LED_ERR, OUTPUT); pinMode(BUZZER, OUTPUT);
  SPI.begin(18, 19, 23, SS_PIN);
  rfid.PCD_Init();
  connectWifi();
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  while (time(nullptr) < 1700000000) delay(300);   // wait for NTP
  signIn();
  Serial.println("sbes.erp reader ready");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWifi();
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;
  String uid = readUid();
  rfid.PICC_HaltA(); rfid.PCD_StopCrypto1();
  if (uid == lastUid && millis() - lastScan < 3000) return;   // debounce
  lastUid = uid; lastScan = millis();
  Serial.println("Card: " + uid);
  handleCard(uid);
}

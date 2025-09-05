#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <math.h>
#include <Servo.h>

// ----- RFID Pins -----
#define SS_PIN 10
#define RST_PIN 9
MFRC522 rfid(SS_PIN, RST_PIN);

// ----- Sound Sensor + LED -----
const int micPin = A0;
const int ledPin = 6;

// ----- Ultrasonic + Buzzer -----
#define TRIG_PIN 7  
#define ECHO_PIN 8
#define BUZZER 5

long duration;
int distance;
int prevDistance = 0;

// ----- Servo Motor -----
Servo myServo;
#define SERVO_PIN 3

// LCD 
LiquidCrystal_I2C lcd(0x27, 16, 2);

// Settings for Sound
const unsigned long sampleWindow = 200;
const float referenceVoltage = 5.0;
const int adcMax = 1023;
const float adcMid = adcMax / 2.0;

float calibration_offset = 40.0;
float threshold_dB = 35.0;  

// Attendance system
const int totalStudents = 4;
int presentCount = 0;
int absentCount = totalStudents;
String scannedUIDs[10];  // store scanned UIDs (max 10 cards for now)
int scannedCount = 0;

// Last scanned UID (as string)
String lastUID = "None";

// To avoid showing sound too often
unsigned long lastNoiseTime = 0;
bool showingNoise = false;

// --- check if UID is already scanned ---
bool isAlreadyScanned(String uid) {
  for (int i = 0; i < scannedCount; i++) {
    if (scannedUIDs[i] == uid) return true;
  }
  return false;
}

void setup() {
  Serial.begin(9600);
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("Place your card near the reader...");

  pinMode(ledPin, OUTPUT);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(BUZZER, OUTPUT);
  // Servo setup
  myServo.attach(SERVO_PIN);
  myServo.write(10); // Start at closed position


  // LCD setup
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Smart Classroom");
  lcd.setCursor(0, 1);
  lcd.print("Initializing...");
  delay(1500);
  lcd.clear();

  
}

void loop() {
  // -------- RFID Reading (Attendance) --------
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    lastUID = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
      if (rfid.uid.uidByte[i] < 0x10) lastUID += "0";
      lastUID += String(rfid.uid.uidByte[i], HEX);
      if (i != rfid.uid.size - 1) lastUID += ":";
    }
    lastUID.toUpperCase();

    Serial.print("UID: ");
    Serial.println(lastUID);

    if (!isAlreadyScanned(lastUID)) {
      scannedUIDs[scannedCount++] = lastUID;
      presentCount++;
      absentCount = totalStudents - presentCount;

      // --- Servo Door Action (Smooth) ---
      // Slowly open from 10° to 120°
      for (int pos = 10; pos <= 120; pos += 1) {
        myServo.write(pos);
        delay(15); // adjust speed (higher delay = slower movement)
      }
      delay(1500);  // keep door open for 1.5 seconds (was 1 sec before)

      // Slowly close from 120° back to 10°
      for (int pos = 120; pos >= 10; pos -= 1) {
        myServo.write(pos);
        delay(15);
      }
    }

    // LCD show attendance
    lcd.clear();
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Present:");
    lcd.print(presentCount);
    lcd.setCursor(0, 1);
    lcd.print("Absent:");
    lcd.print(absentCount);

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }

  // -------- Sound Level Measurement --------
  unsigned long startMillis = millis();
  unsigned long sampleCount = 0;
  double sumSquares = 0;

  while (millis() - startMillis < sampleWindow) {
    int sample = analogRead(micPin);
    double centered = sample - adcMid;
    sumSquares += centered * centered;
    sampleCount++;
  }

  if (sampleCount > 0) {
    double meanSquare = sumSquares / sampleCount;
    double rms = sqrt(meanSquare);
    double Vrms = (rms * referenceVoltage) / adcMax;

    double dB = -100.0;
    if (Vrms > 0.000001) {
      dB = 20.0 * log10(Vrms) + calibration_offset;
    }

    Serial.print("DB:");
    Serial.println(dB, 1);

    if (dB >= threshold_dB) {
      digitalWrite(ledPin, HIGH);
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Noise level HIGH!");
      lcd.setCursor(0, 1);
      lcd.print(dB, 1);
      lcd.print(" dB");
      lastNoiseTime = millis();
      showingNoise = true;
    } else {
      digitalWrite(ledPin, LOW);
    }
  }

  // -------- Ultrasonic Reading + Buzzer --------
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  duration = pulseIn(ECHO_PIN, HIGH);
  distance = duration * 0.034 / 2;

  bool motionDetected = false;
  if (prevDistance != 0 && abs(distance - prevDistance) > 5) {
    digitalWrite(BUZZER, HIGH);  
    delay(300);
    digitalWrite(BUZZER, LOW);
    motionDetected = true;

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Back Door");
    lcd.setCursor(0, 1);
    lcd.print("Movement!");

    Serial.print("Motion detected. Distance: ");
    Serial.print(distance);
    Serial.println(" cm");
  } else {
    digitalWrite(BUZZER, LOW);  
  }
  prevDistance = distance;

  // -------- LCD Display --------
  if (!motionDetected) {  
    if (showingNoise && millis() - lastNoiseTime > 1000) {
      showingNoise = false;
      lcd.clear();
    }

    if (!showingNoise) {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Present:");
      lcd.print(presentCount);
      lcd.setCursor(0, 1);
      lcd.print("Absent:");
      lcd.print(absentCount);
    }
  }

  delay(500);
}

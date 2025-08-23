#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <math.h>

// ----- RFID Pins -----
#define SS_PIN 10
#define RST_PIN 9
MFRC522 rfid(SS_PIN, RST_PIN);

// ----- PIR & Buzzer Pins -----
int pirPin = 2;       
int buzzerPin = 4;    

// ----- Sound Sensor + LED -----
const int micPin = A0;    
const int ledPin = 6;     

// LCD (I2C address may be 0x27 or 0x3F → check with scanner)
LiquidCrystal_I2C lcd(0x27, 16, 2);

// Settings for Sound
const unsigned long sampleWindow = 200; 
const float referenceVoltage = 5.0;     
const int adcMax = 1023;
const float adcMid = adcMax / 2.0;      

float calibration_offset = 40.0; 
float threshold_dB = 50.0;       

// Attendance variables
int presentCount = 0;
int absentCount = 10;  // Example: total students = 10, will decrease as present are marked

// To avoid showing sound too often
unsigned long lastNoiseTime = 0;
bool showingNoise = false;

void setup() {
  Serial.begin(9600);
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("Place your card near the reader...");

  pinMode(pirPin, INPUT);
  pinMode(buzzerPin, OUTPUT);
  pinMode(ledPin, OUTPUT);

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
  // -------- PIR Motion Detection --------
  int motion = digitalRead(pirPin);
  if (motion == HIGH) {
    Serial.println("Motion detected!");
    digitalWrite(buzzerPin, HIGH);  
    delay(100); 
    digitalWrite(buzzerPin, LOW);   
  }

  // -------- RFID Reading (Attendance) --------
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    Serial.print("UID: ");
    for (byte i = 0; i < rfid.uid.size; i++) {
      Serial.print(rfid.uid.uidByte[i] < 0x10 ? "0" : "");
      Serial.print(rfid.uid.uidByte[i], HEX);
      if (i != rfid.uid.size - 1) Serial.print(":");
    }
    Serial.println();

    presentCount++;
    if (absentCount > 0) absentCount--; 

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

    if (dB >= threshold_dB) {
      digitalWrite(ledPin, HIGH);
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Noise Level:");
      lcd.setCursor(0, 1);
      lcd.print(dB, 1);
      lcd.print(" dB");
      lastNoiseTime = millis();
      showingNoise = true;
    } else {
      digitalWrite(ledPin, LOW);
    }
  }

  // -------- LCD Display --------
  if (showingNoise && millis() - lastNoiseTime > 1000) {
    // After 1 sec, return to attendance view
    showingNoise = false;
    lcd.clear();
  }

  if (!showingNoise) {
    lcd.setCursor(0, 0);
    lcd.print("Present: ");
    lcd.print(presentCount);
    lcd.setCursor(0, 1);
    lcd.print("Absent:  ");
    lcd.print(absentCount);
  }

  delay(100);
}

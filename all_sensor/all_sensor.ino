#include <SPI.h>
#include <MFRC522.h>
#include <math.h>

// ----- RFID Pins -----
#define SS_PIN 10
#define RST_PIN 9
MFRC522 rfid(SS_PIN, RST_PIN);

// ----- PIR & Buzzer Pins -----
int pirPin = 2;       // PIR output pin
int buzzerPin = 4;    // Buzzer pin

// ----- Sound Sensor + LED -----
const int micPin = A0;    // Analog input for microphone
const int ledPin = 6;     // LED moved to D6 (avoid SPI conflict)

// Settings
const unsigned long sampleWindow = 200; // ms for RMS averaging
const float referenceVoltage = 5.0;     // Arduino UNO ADC reference
const int adcMax = 1023;
const float adcMid = adcMax / 2.0;      // expected bias ~512

// Calibration
float calibration_offset = 40.0; // adjust based on phone SPL app
float threshold_dB = 30.0;       // LED turns on at this dB

void setup() {
  // RFID setup
  Serial.begin(115200);
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("Place your card near the reader...");

  // PIR & buzzer setup
  pinMode(pirPin, INPUT);
  pinMode(buzzerPin, OUTPUT);

  // LED setup
  pinMode(ledPin, OUTPUT);
}

void loop() {
  // -------- PIR Motion Detection --------
  int motion = digitalRead(pirPin);
  if (motion == HIGH) {
    Serial.println("Motion detected!");
    digitalWrite(buzzerPin, HIGH);  
    delay(100); // buzz briefly
    digitalWrite(buzzerPin, LOW);   
  }

  // -------- RFID Reading --------
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    Serial.print("UID: ");
    for (byte i = 0; i < rfid.uid.size; i++) {
      Serial.print(rfid.uid.uidByte[i] < 0x10 ? "0" : "");
      Serial.print(rfid.uid.uidByte[i], HEX);
      if (i != rfid.uid.size - 1) Serial.print(":");
    }
    Serial.println();
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }

  // -------- Sound Level Measurement --------
  unsigned long startMillis = millis();
  unsigned long sampleCount = 0;
  double sumSquares = 0;

  while (millis() - startMillis < sampleWindow) {
    int sample = analogRead(micPin);
    double centered = sample - adcMid; // remove DC bias
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

    Serial.print("Vrms: ");
    Serial.print(Vrms, 6);
    Serial.print(" V | SPL: ");
    Serial.print(dB, 1);
    Serial.println(" dB");

    if (dB >= threshold_dB) {
      digitalWrite(ledPin, HIGH);
    } else {
      digitalWrite(ledPin, LOW);
    }
  }

  delay(50); // short pause
}

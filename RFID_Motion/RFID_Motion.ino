#include <SPI.h>
#include <MFRC522.h>

// ----- RFID Pins -----
#define SS_PIN 10
#define RST_PIN 9
MFRC522 rfid(SS_PIN, RST_PIN);

// ----- PIR & Buzzer Pins -----
int pirPin = 2;       // PIR output pin
int buzzerPin = 4;    // Buzzer pin

void setup() {
  // RFID setup
  Serial.begin(9600);
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("Place your card near the reader...");

  // PIR & buzzer setup
  pinMode(pirPin, INPUT);
  pinMode(buzzerPin, OUTPUT);
}

void loop() {
  // -------- PIR Motion Detection --------
  int motion = digitalRead(pirPin);
  if (motion == HIGH) {
    Serial.println("Motion detected!");
    digitalWrite(buzzerPin, HIGH);  
    delay(100); // buzz briefly
    digitalWrite(buzzerPin, LOW);   
  } else {
    //Serial.println("No motion");
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

  delay(100);
}
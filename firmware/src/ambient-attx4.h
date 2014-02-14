#include <avr/io.h>
#include <avr/interrupt.h>
#include "spi_via_usi_driver.c"

#ifndef cbi
#define cbi(sfr, bit) (_SFR_BYTE(sfr) &= ~_BV(bit))
#endif
#ifndef sbi
#define sbi(sfr, bit) (_SFR_BYTE(sfr) |= _BV(bit))
#endif

// Port A, pin 1
#define SOUND_PIN 1

// Port B, pin 2
#define CS_PIN  2

// Port A, pin 3
#define LIGHT_PIN 3

// Port B Pin 1
#define IRQ_PIN 1

// Available commands
#define ACK_CMD  0
#define FIRMWARE_CMD 1
#define LIGHT_CMD 2
#define SOUND_CMD  3
#define LIGHT_TRIGGER_CMD 4
#define SOUND_TRIGGER_CMD 5
#define TRIGGER_FETCH_CMD 6

// Response constants
#define ALIVE_CODE 0x55
#define ACK_CODE 0x33
#define STOP_CMD 0x16

#define FIRMWARE_VERSION 0x01

// Size of buffers (be careful about making this bigger, could run out of bss)
#define BUF_SIZE 10

// The type for the buffer
typedef struct 
{
  volatile uint16_t buffer[BUF_SIZE]; 
  volatile uint8_t bufferLocation;
} DataBuffer;
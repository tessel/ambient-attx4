// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

#include <avr/io.h>
#include <avr/interrupt.h>
#include "src/deps/avr-usi-spi/spi_via_usi_driver.c"
#include "src/deps/attiny-firmware-common/include/common.h"

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

// Port A Pin 5
#define MISO 5

// Port A pin 6
#define MOSI 6

// Available commands
#define ACK_CMD  0
#define FIRMWARE_CMD 1
#define LIGHT_CMD 2
#define SOUND_CMD  3
#define LIGHT_TRIGGER_CMD 4
#define SOUND_TRIGGER_CMD 5
#define TRIGGER_FETCH_CMD 6
#define CRC_CMD 7
#define MODULE_ID_CMD 8

// Response constants
#define ALIVE_CODE 0x55
#define ACK_CODE 0x33
#define STOP_CMD 0x16

// Size of buffers (be careful about making this bigger, could run out of bss)
#define BUF_SIZE 10

// The type for the buffer
typedef struct
{
  volatile uint16_t buffer[BUF_SIZE];
  volatile uint8_t bufferLocation;
} DataBuffer;

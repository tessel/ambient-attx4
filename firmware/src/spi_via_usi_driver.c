// This file has been prepared for Doxygen automatic documentation generation.

/*! \file ********************************************************************

*

* Atmel Corporation

*

* \li File:               spi_via_usi_driver.c

* \li Compiler:           IAR EWAAVR 3.10c

* \li Support mail:       avr@atmel.com

*

* \li Supported devices:  All devices with Universal Serial Interface (USI)

*                         capabilities can be used.

*                         The example is written for ATmega169.

*

* \li AppNote:            AVR319 - Using the USI module for SPI communication.

*

* \li Description:        Example on how to use the USI module for communicating

*                         with SPI compatible devices. The functions and variables

*                         prefixed 'spiX_' can be renamed to be able to use several

*                         spi drivers (using different interfaces) with similar names.

*                         Some basic SPI knowledge is assumed.

*

*                         $Revision: 1.4 $

*                         $Date: Monday, September 13, 2004 12:08:54 UTC $

****************************************************************************/

#include <avr/io.h>

#include <avr/interrupt.h>







/* USI port and pin definitions.
 */
#define USI_OUT_REG	PORTA	//!< USI port output register.
#define USI_IN_REG	PINA	//!< USI port input register.
#define USI_DIR_REG	DDRA	//!< USI port direction register.
#define USI_CLOCK_PIN	PA4	//!< USI clock I/O pin.
#define USI_DATAIN_PIN	PA6	//!< USI data input pin.
#define USI_DATAOUT_PIN	PA5	//!< USI data output pin.









/*  Speed configuration:

 *  Bits per second = CPUSPEED / PRESCALER / (COMPAREVALUE+1) / 2.

 *  Maximum = CPUSPEED / 64.

 */

#define TC0_PRESCALER_VALUE 64	//!< Must be 1, 8, 64, 256 or 1024.

#define TC0_COMPARE_VALUE   1	//!< Must be 0 to 255. Minimum 31 with prescaler CLK/1.









/*  Prescaler value converted to bit settings.

 */

#if TC0_PRESCALER_VALUE == 1

	#define TC0_PS_SETTING (1<<CS00)

#elif TC0_PRESCALER_VALUE == 8

	#define TC0_PS_SETTING (1<<CS01)

#elif TC0_PRESCALER_VALUE == 64

	#define TC0_PS_SETTING (1<<CS01)|(1<<CS00)

#elif TC0_PRESCALER_VALUE == 256

	#define TC0_PS_SETTING (1<<CS02)

#elif TC0_PRESCALER_VALUE == 1024

	#define TC0_PS_SETTING (1<<CS02)|(1<<CS00)

#else

	#error Invalid T/C0 prescaler setting.

#endif







/*! \brief  Data input register buffer.

 *

 *  Incoming bytes are stored in this byte until the next transfer is complete.

 *  This byte can be used the same way as the SPI data register in the native

 *  SPI module, which means that the byte must be read before the next transfer

 *  completes and overwrites the current value.

 */

unsigned char storedUSIDR;







/*! \brief  Driver status bit structure.

 *

 *  This struct contains status flags for the driver.

 *  The flags have the same meaning as the corresponding status flags

 *  for the native SPI module. The flags should not be changed by the user.

 *  The driver takes care of updating the flags when required.

 */

struct usidriverStatus_t {

	unsigned char masterMode : 1;       //!< True if in master mode.

	unsigned char transferComplete : 1; //!< True when transfer completed.

	unsigned char writeCollision : 1;   //!< True if put attempted during transfer.

};



volatile struct usidriverStatus_t spiX_status; //!< The driver status bits.







/*! \brief  Timer/Counter 0 Compare Match Interrupt handler.

 *

 *  This interrupt handler is only enabled when transferring data

 *  in master mode. It toggles the USI clock pin, i.e. two interrupts

 *  results in one clock period on the clock pin and for the USI counter.

 */

ISR(TIM0_COMPA_vect)
{
	USICR |= (1<<USITC);	// Toggle clock output pin.
}







/*! \brief  USI Timer Overflow Interrupt handler.

 *

 *  This handler disables the compare match interrupt if in master mode.

 *  When the USI counter overflows, a byte has been transferred, and we

 *  have to stop the timer tick.

 *  For all modes the USIDR contents are stored and flags are updated.

 */

ISR(USI_OVF_vect)

{

	// Master must now disable the compare match interrupt

	// to prevent more USI counter clocks.

	if( spiX_status.masterMode == 1 ) {

		TIMSK0 &= ~(1<<OCIE0A);

	}

	

	// Update flags and clear USI counter

	USISR = (1<<USIOIF);

	spiX_status.transferComplete = 1;



	// Copy USIDR to buffer to prevent overwrite on next transfer.

	storedUSIDR = USIDR;

}







/*! \brief  Initialize USI as SPI master.

 *

 *  This function sets up all pin directions and module configurations.

 *  Use this function initially or when changing from slave to master mode.

 *  Note that the stored USIDR value is cleared.

 *

 *  \param spi_mode  Required SPI mode, must be 0 or 1.

 */

void spiX_initmaster( char spi_mode )

{

	// Configure port directions.

	USI_DIR_REG |= (1<<USI_DATAOUT_PIN) | (1<<USI_CLOCK_PIN); // Outputs.

	USI_DIR_REG &= ~(1<<USI_DATAIN_PIN);                      // Inputs.

	USI_OUT_REG |= (1<<USI_DATAIN_PIN);                       // Pull-ups.

	

	// Configure USI to 3-wire master mode with overflow interrupt.

	USICR = (1<<USIOIE) | (1<<USIWM0) |

	        (1<<USICS1) | (spi_mode<<USICS0) |

	        (1<<USICLK);


	// Enable 'Clear Timer on Compare match' and init prescaler.

	// This made it impossible to get interrupts for some reason
	// TCCR0A = (1<<WGM01);
	TCCR0B = TC0_PS_SETTING;
	

	// Init Output Compare Register.

	OCR0A = TC0_COMPARE_VALUE;

	

	// Init driver status register.

	spiX_status.masterMode       = 1;

	spiX_status.transferComplete = 0;

	spiX_status.writeCollision   = 0;
	

	storedUSIDR = 0;

}







/*! \brief  Initialize USI as SPI slave.

 *

 *  This function sets up all pin directions and module configurations.

 *  Use this function initially or when changing from master to slave mode.

 *  Note that the stored USIDR value is cleared.

 *

 *  \param spi_mode  Required SPI mode, must be 0 or 1.

 */

void spiX_initslave( char spi_mode )

{

	// Configure port directions.

	USI_DIR_REG |= (1<<USI_DATAOUT_PIN);                      // Outputs.

	USI_DIR_REG &= ~(1<<USI_DATAIN_PIN) | (1<<USI_CLOCK_PIN); // Inputs.

	USI_OUT_REG |= (1<<USI_DATAIN_PIN) | (1<<USI_CLOCK_PIN);  // Pull-ups.

	

	// Configure USI to 3-wire slave mode with overflow interrupt.

	USICR = (1<<USIOIE) | (1<<USIWM0) |

	        (1<<USICS1) | (spi_mode<<USICS0);

	

	// Init driver status register.

	spiX_status.masterMode       = 0;

	spiX_status.transferComplete = 0;

	spiX_status.writeCollision   = 0;

	

	storedUSIDR = 0;

}







/*! \brief  Put one byte on bus.

 *

 *  Use this function like you would write to the SPDR register in the native SPI module.

 *  Calling this function in master mode starts a transfer, while in slave mode, a

 *  byte will be prepared for the next transfer initiated by the master device.

 *  If a transfer is in progress, this function will set the write collision flag

 *  and return without altering the data registers.

 *

 *  \returns  0 if a write collision occurred, 1 otherwise.

 */

char spiX_put( unsigned char val )

{

	// Check if transmission in progress,

	// i.e. USI counter unequal to zero.

	if( (USISR & 0x0F) != 0 ) {

		// Indicate write collision and return.

		spiX_status.writeCollision = 1;

		return 0;

	}

	// Reinit flags.

	spiX_status.transferComplete = 0;

	spiX_status.writeCollision = 0;



	// Put data in USI data register.

	USIDR = val;

	

	// Master should now enable compare match interrupts.

	if( spiX_status.masterMode == 1 ) {

		TIFR0 |= (1<<OCF0A);   // Clear compare match flag.

		TIMSK0 |= (1<<OCIE0A); // Enable compare match interrupt.

	}



	if( spiX_status.writeCollision == 0 ) return 1;

	return 0;

}







/*! \brief  Get one byte from bus.

 *

 *  This function only returns the previous stored USIDR value.

 *  The transfer complete flag is not checked. Use this function

 *  like you would read from the SPDR register in the native SPI module.

 */

unsigned char spiX_get(void)

{

	return storedUSIDR;

}







/*! \brief  Wait for transfer to complete.

 *

 *  This function waits until the transfer complete flag is set.

 *  Use this function like you would wait for the native SPI interrupt flag.

 */

void spiX_wait(void)

{

	do {} while( spiX_status.transferComplete == 0 );

}







// end of file

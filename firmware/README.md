
Setting the 8MHz fuse bit:
```
avrdude -p attiny44 -P /dev/tty.usbmodem1411 -c avrisp -U lfuse:w:0xe2:m -u -b 19200
```

CC = gcc
CFLAGS = -Wall -O2 -g
LDFLAGS = -lpthread

TARGETS = epoll-bench epoll-lt-et-demo

UNAME_S := $(shell uname -s)

all: check_os $(TARGETS)

check_os:
ifeq ($(UNAME_S),Darwin)
	@echo "Note: epoll is Linux-specific. These programs require Linux to build and run."
	@echo "On macOS, use Docker/Linux VM, or adapt to kqueue for learning purposes."
endif

epoll-bench: epoll-bench.c
ifeq ($(UNAME_S),Linux)
	$(CC) $(CFLAGS) -o $@ $< $(LDFLAGS)
else
	@echo "Skipping $@ (requires Linux)"
endif

epoll-lt-et-demo: epoll-lt-et-demo.c
ifeq ($(UNAME_S),Linux)
	$(CC) $(CFLAGS) -o $@ $< $(LDFLAGS)
else
	@echo "Skipping $@ (requires Linux)"
endif

clean:
	rm -f $(TARGETS)

.PHONY: all clean check_os

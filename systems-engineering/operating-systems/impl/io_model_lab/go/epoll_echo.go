//go:build linux

package main

import (
	"fmt"
	"net"
	"syscall"
	"golang.org/x/sys/unix"
)

const (
	port       = "8080"
	maxEvents  = 1024
)

func setNonblocking(fd int) error {
	return unix.SetNonblock(fd, true)
}

func main() {
	// 1. create listening socket
	ln, err := net.Listen("tcp", ":"+port)
	if err != nil {
		panic(err)
	}
	defer ln.Close()

	// extract underlying file descriptor
	file, err := ln.(*net.TCPListener).File()
	if err != nil {
		panic(err)
	}
	listenFD := int(file.Fd())
	setNonblocking(listenFD)

	// 2. create epoll instance
	epfd, err := unix.EpollCreate1(unix.EPOLL_CLOEXEC)
	if err != nil {
		panic(err)
	}
	defer unix.Close(epfd)

	// 3. add listen fd to epoll (ET mode for accept)
	event := unix.EpollEvent{
		Events: unix.EPOLLIN | unix.EPOLLET,
		Fd:     int32(listenFD),
	}
	if err := unix.EpollCtl(epfd, unix.EPOLL_CTL_ADD, listenFD, &event); err != nil {
		panic(err)
	}

	events := make([]unix.EpollEvent, maxEvents)
	fmt.Println("epoll echo server on :" + port)

	// client state: fd -> net.Conn
	conns := make(map[int]net.Conn)

	for {
		n, err := unix.EpollWait(epfd, events, -1)
		if err != nil {
			if err == unix.EINTR {
				continue
			}
			panic(err)
		}

		for i := 0; i < n; i++ {
			fd := int(events[i].Fd)
			if fd == listenFD {
				// accept all pending connections (ET: loop until EAGAIN)
				for {
					connFD, _, err := unix.Accept(listenFD)
					if err != nil {
						if err == unix.EAGAIN || err == unix.EWOULDBLOCK {
							break
						}
						panic(err)
					}
					setNonblocking(connFD)
					event := unix.EpollEvent{
						Events: unix.EPOLLIN | unix.EPOLLET,
						Fd:     int32(connFD),
					}
					unix.EpollCtl(epfd, unix.EPOLL_CTL_ADD, connFD, &event)
					// wrap in net.Conn for convenient Read/Write
					f := &net.TCPConn{}
					// NOTE: we keep a raw fd map for simplicity in this demo.
					// Production code would use syscall.RawConn or custom net.Conn.
					conns[connFD] = nil // placeholder to track fd
				}
			} else {
				// read echo loop (must drain in ET)
				buf := make([]byte, 1024)
				for {
					nr, err := unix.Read(fd, buf)
					if nr > 0 {
						_, _ = unix.Write(fd, buf[:nr]) // echo
					}
					if err != nil {
						if err == unix.EAGAIN || err == unix.EWOULDBLOCK {
							break
						}
						// error or close
						unix.Close(fd)
						delete(conns, fd)
						break
					}
					if nr == 0 {
						unix.Close(fd)
						delete(conns, fd)
						break
					}
				}
			}
		}
	}
}

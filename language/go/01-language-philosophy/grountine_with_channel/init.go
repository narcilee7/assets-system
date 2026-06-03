package grountinewithchannel

import "fmt"

func DebugGorountine() {
	go func() {
		fmt.Println("running in goroutine")
	}()
	// fmt.Println("sync")
}

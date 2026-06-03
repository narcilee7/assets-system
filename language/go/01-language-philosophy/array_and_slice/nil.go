package arrayandslice

import (
	"encoding/json"
	"fmt"
)

func DebugNil() {
	var s1 []int  // nil slice
	s2 := []int{} // empty slice: ptr != nil, len=0, cap=0
	fmt.Println("s1", s1)
	fmt.Println("s2", s2)

	fmt.Println(s1 == nil)
	fmt.Println(s2 == nil)

	s1Json, _ := json.Marshal(s1)
	s2Json, _ := json.Marshal(s2)
	fmt.Println("s1Json", string(s1Json))
	fmt.Println("s2Json", string(s2Json))
}

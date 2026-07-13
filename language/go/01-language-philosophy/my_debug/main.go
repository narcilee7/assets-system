package main

import "fmt"

// func main() {
// 	var p *int
// 	fmt.Println(p)
// 	var v int
// 	fmt.Println(v)
// 	fmt.Println(&v)
// 	fmt.Println(&p)
// 	fmt.Println(*p)
// }

func modity(x int) {
	x = 100
}

func modityByPoint(x *int) {
	*x = 100
}

func main() {
	a := 1
	modity(a)
	fmt.Println(a)
	modityByPoint(&a)
	fmt.Println(a)

	pp := new(int)
	fmt.Println(pp)
	ss := make([]int, 0, 10)
	fmt.Println(ss) // nil
	mm := make(map[string]int) // map{]}
	fmt.Println(mm)  
	ch := make(chan int) // 
	fmt.Println(ch)

	items := []int{1, 2, 3}
	pirs := make([]*int, 3)

	for i, v := range items {
		fmt.Println(v)
		fmt.Println(&v)
		pirs[i] = &v
	}

	var slice1 = []int{1, 2, 3}
	ppp := slice1[0]
	slice1 = append(slice1, 4)
	fmt.Println(ppp)
}
package structs

type Animal struct {
	Name string
}

func (a Animal) Speak() string {
	return "Hello, I am " + a.Name
}

type Dog struct {
	Animal
	Breed string
}

func (d Dog) Speak() string {
	return "Woof! " + d.Animal.Speak()
}

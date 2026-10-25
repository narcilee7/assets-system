fn greet_world() {
    let southern_germany = "Grüß Gott!";
    let chinese = "世界，你好";
    let english = "World, hello";
    let regions = [southern_germany, chinese, english];
    // for region in regions.iter() {
    //     println!("{}", &region);
    // }
    for region in regions.iter() {
        println!("{}", region);
    }
}

fn ez_fn() {
   let penguin_data = "\
   common name,length (cm)
   Little penguin,33
   Yellow-eyed penguin,65
   Fiordland penguin,60
   Invalid,data
   ";

   let records = penguin_data.lines()
}

fn main() {
    greet_world();
}

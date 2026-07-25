CREATE Table students (
  id INT PRIMARY KEY,
  name VARCHAR(40),
  course_id INT,
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE Table courses(
  id INT PRIMARY KEY,
  name VARCHAR(10),
)

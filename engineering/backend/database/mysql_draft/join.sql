-- INNER JOIN
SELECT employees.name, departments.name
FROM employees
INNER JOIN departments
ON employees.department_id = departments.id;

-- 左外连接
SELECT employess.name, departments.name
FROM employees
LEFT JOIN departments
ON employees.department_id = departments.id

-- right join
SELECT employess.name, departments.name
FROM employees
RIGHT JOIN departments
ON employees.department_id = departments.id

-- FULL JOIN
ON employees.department_id = departments.id


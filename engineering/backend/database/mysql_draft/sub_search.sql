-- 子查询

SELECT column_name(s)
FROM table_name
WHERE column_name IN (value1, value2, ...)

SELECT column_name(s)
FROM table_name
WHERE column_name IN(SELECT column_name FROM another_table WHERE condition)

SELECT c.name FROM Customers as c
WHERE Country IN ('China', "Japane")

-- Exits子查询是否能返回至少一行数据，不care子查询返回什么数据，只关心结果。
SELECT column_name(s)
FROM table_name
WHERE EXISTS (SELECT column_name FROM anthor_table WHERE condition);

SELECT * from Customers
WHERE EXISTS (SELECT 1 FROM Orders WHERE Orders.CustomerID= Customers.CustomerID)


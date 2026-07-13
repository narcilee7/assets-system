SELECT 
  o.order_id,
  o.status,
  o.total_amount,
  o.created_at,
  COUNT(oi.item_id) AS item_count
FROM orders O
LEFT JOIN order_items oi ON order_id = oi.order_id
WHERE o.user_id = ?
GROUP BY o.order_id
ORDER BY o.created_at DESC
LIMIT 10;

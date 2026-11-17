-- Initial Sketch Cafe menu: 44 photographed food items and eight approved drinks.
-- Prices are integer paise. Serving-time restrictions are intentionally omitted.
-- The application runs this trusted script inside its startup transaction.
-- A version guard makes repeat execution a no-op, preserving admin edits.
CREATE TEMP TABLE menu_seed_required AS
SELECT 1 WHERE NOT EXISTS (
  SELECT 1 FROM app_settings WHERE key='menu_version' AND value='sketch-photo-menu-2026-11-17'
);

-- Retain the previous rows for saved order references and price snapshots.
UPDATE items SET archived=1, available=0
WHERE archived=0 AND EXISTS (SELECT 1 FROM menu_seed_required);
UPDATE categories SET archived=1
WHERE archived=0 AND EXISTS (SELECT 1 FROM menu_seed_required);

WITH initial_categories(name) AS (VALUES
  ('Snacks & Light Bites'),
  ('Chinese Corner'),
  ('Parathas'),
  ('South Indian Specials'),
  ('North Indian Favourites'),
  ('Drinks')
)
INSERT INTO categories(name)
SELECT name FROM initial_categories WHERE EXISTS (SELECT 1 FROM menu_seed_required);

-- Category names are resolved to database IDs; no fixed IDs are assumed.
WITH initial_menu(category, name, description, price) AS (VALUES
  ('Snacks & Light Bites', 'Vada Pav Combo', 'Vada pav served as a snack combo.', 7000),
  ('Snacks & Light Bites', 'Pav Bhaji', 'Spiced vegetable bhaji served with pav.', 5200),
  ('Snacks & Light Bites', 'Paneer Kathi Roll', 'Paneer filling wrapped in a kathi roll.', 6300),
  ('Snacks & Light Bites', 'Chicken Kathi Roll', 'Chicken filling wrapped in a kathi roll.', 7800),
  ('Snacks & Light Bites', 'Sauteed Veggies + Garlic Bread', 'Sauteed vegetables served with garlic bread.', 9000),
  ('Snacks & Light Bites', 'Grilled Paneer Sandwich', 'Grilled sandwich with a paneer filling.', 7800),
  ('Snacks & Light Bites', 'Grilled Chicken Sandwich', 'Grilled sandwich with a chicken filling.', 9000),
  ('Chinese Corner', 'Veg Fried Rice', 'Fried rice tossed with vegetables.', 5800),
  ('Chinese Corner', 'Egg Fried Rice', 'Fried rice tossed with egg.', 6800),
  ('Chinese Corner', 'Chicken Fried Rice', 'Fried rice tossed with chicken.', 9000),
  ('Chinese Corner', 'Veg Hakka Noodles', 'Hakka noodles tossed with vegetables.', 5800),
  ('Chinese Corner', 'Chicken Hakka Noodles', 'Hakka noodles tossed with chicken.', 10000),
  ('Chinese Corner', 'Chinese Veg Combo', 'Vegetarian Chinese meal combo.', 9000),
  ('Chinese Corner', 'Chinese Non-Veg Combo', 'Non-vegetarian Chinese meal combo.', 13000),
  ('Chinese Corner', 'Veg Manchurian (8 pcs)', 'Eight pieces of vegetable Manchurian.', 9500),
  ('Chinese Corner', 'Chilli Paneer (6 pcs)', 'Six pieces of paneer in a chilli preparation.', 10500),
  ('Chinese Corner', 'Chilli Chicken (6 pcs)', 'Six pieces of chicken in a chilli preparation.', 13000),
  ('Chinese Corner', 'French Fries', 'A portion of crispy potato fries.', 5800),
  ('Chinese Corner', 'Chilli Potato', 'Potatoes tossed in a chilli preparation.', 5800),
  ('Chinese Corner', 'Spring Rolls (Veg)', 'Vegetarian spring rolls.', 7800),
  ('Parathas', 'Stuffed Paratha', 'Paratha with a savoury stuffing.', 3500),
  ('Parathas', 'Paneer Paratha', 'Paratha with a paneer stuffing.', 5200),
  ('Parathas', 'Egg Paratha', 'Paratha prepared with egg.', 4500),
  ('South Indian Specials', 'Idli Sambhar (2 pcs)', 'Two idlis served with sambhar.', 4700),
  ('South Indian Specials', 'Medu Vada Sambhar (2 pcs)', 'Two medu vadas served with sambhar.', 4700),
  ('South Indian Specials', 'Masala Dosa', 'Dosa with a spiced potato filling.', 6300),
  ('South Indian Specials', 'Mysore Masala Dosa', 'Mysore-style dosa with masala filling.', 7800),
  ('South Indian Specials', 'Cheese Masala Dosa', 'Masala dosa with cheese.', 8500),
  ('South Indian Specials', 'Paneer Dosa', 'Dosa with a paneer filling.', 7800),
  ('South Indian Specials', 'Onion Uttapam', 'Uttapam topped with onion.', 6300),
  ('South Indian Specials', 'Cheese Uttapam', 'Uttapam topped with cheese.', 7800),
  ('South Indian Specials', 'Chole Bhature', 'Chole served with bhature.', 6300),
  ('South Indian Specials', 'Poori Bhaji (4 pcs)', 'Four pooris served with bhaji.', 5200),
  ('South Indian Specials', 'Bread Omelette', 'Bread served with an omelette.', 4700),
  ('South Indian Specials', 'Boiled Egg (2 pcs)', 'Two boiled eggs.', 2100),
  ('North Indian Favourites', 'Rice Combo', 'Rice meal combo.', 5500),
  ('North Indian Favourites', 'Chapati Combo', 'Chapati meal combo.', 5500),
  ('North Indian Favourites', 'Egg Curry with Rice/Chapati', 'Egg curry served with rice or chapati.', 7800),
  ('North Indian Favourites', 'Chicken Curry with Rice/Chapati', 'Chicken curry served with rice or chapati.', 15500),
  ('North Indian Favourites', 'Chicken Curry', 'A portion of chicken curry.', 12000),
  ('North Indian Favourites', 'Egg Curry', 'A portion of egg curry.', 4700),
  ('North Indian Favourites', 'North Indian Thali', 'North Indian thali meal.', 8400),
  ('North Indian Favourites', 'Fish Curry Combo', 'Fish curry meal combo.', 17000),
  ('North Indian Favourites', 'Mutton Curry Combo', 'Mutton curry meal combo.', 19500),
  ('Drinks', 'Tea', 'A cup of hot tea.', 1500),
  ('Drinks', 'Black Coffee', 'Hot coffee without milk.', 3000),
  ('Drinks', 'Espresso', 'A shot of espresso.', 4000),
  ('Drinks', 'Cappuccino', 'Espresso with steamed milk and foam.', 6000),
  ('Drinks', 'Latte', 'Espresso with steamed milk.', 7000),
  ('Drinks', 'Cold Coffee', 'Chilled coffee with milk.', 8000),
  ('Drinks', 'Coke', 'A chilled Coca-Cola soft drink.', 4000),
  ('Drinks', 'Sprite', 'A chilled lemon-lime soft drink.', 4000)
)
INSERT INTO items(category_id, name, description, image, price, available)
SELECT c.id, m.name, m.description, '', m.price, 1
FROM initial_menu m JOIN categories c ON c.name=m.category AND c.archived=0
WHERE EXISTS (SELECT 1 FROM menu_seed_required);

-- Mark the completed seed in the same transaction as the inserted menu.
INSERT OR REPLACE INTO app_settings(key, value)
SELECT 'menu_version', 'sketch-photo-menu-2026-11-17' FROM menu_seed_required;
DROP TABLE menu_seed_required;

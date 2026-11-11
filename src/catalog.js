import { field, integer, requireValue } from './rules.js';

// Menu reads join each current item to its display category.
const selectItem = `SELECT i.*, c.name AS category FROM items i
  JOIN categories c ON c.id=i.category_id`;

/**
 * Maintain the current menu. Reads include sold-out items and omit archived
 * rows. Staff can toggle availability. Admins can also edit prices and categories.
 */
export function createCatalog(db) {
  // Details and cart mutations share this active-item lookup.
  function item(id) {
    const row = db.get(selectItem + ' WHERE i.id=? AND i.archived=0', id);
    requireValue(row, 'Menu item could not be found.', 404);
    return row;
  }

  return {
    // Empty filters show every active item. Search matches item names and descriptions.
    list(query = '', category = '') {
      return {
        categories: db.all('SELECT id,name FROM categories WHERE archived=0 ORDER BY name'),
        items: db.all(selectItem + ` WHERE i.archived=0
          AND (?='' OR i.category_id=CAST(? AS INTEGER))
          AND (?='' OR instr(lower(i.name || ' ' || i.description),lower(?)) > 0)
          ORDER BY c.name,i.name`, category, category, query, query)
      };
    },
    item,
    // An absent ID creates a category. An existing ID must identify an active category.
    saveCategory(id, data) {
      const name = field(data.name, 'Category name', 60);
      requireValue(!db.get('SELECT 1 FROM categories WHERE name=? AND id!=? AND archived=0', name, id ?? 0),
        'This category name already exists.', 409);
      if (!id) return Number(db.run('INSERT INTO categories(name) VALUES (?)', name).lastInsertRowid);
      requireValue(db.run('UPDATE categories SET name=? WHERE id=? AND archived=0', name, id).changes,
        'Category could not be found.', 404);
      return id;
    },
    // Archive only after active items are moved or removed, so none lose their visible category.
    removeCategory(id) {
      db.transaction(() => {
        requireValue(!db.get('SELECT 1 FROM items WHERE category_id=? AND archived=0', id),
          'Move or remove this category’s items first.', 409);
        requireValue(db.run('UPDATE categories SET archived=1 WHERE id=? AND archived=0', id).changes,
          'Category could not be found.', 404);
      });
    },
    // Validate the category, optional HTTPS image URL and paise before writing the item.
    saveItem(id, data) {
      const category = integer(data.categoryId, 'Category', 1);
      requireValue(db.get('SELECT 1 FROM categories WHERE id=? AND archived=0', category), 'Select an existing category.');
      const image = field(data.image, 'Image URL', 400, 0);
      requireValue(!image || /^https:\/\/[^\s]+$/i.test(image), 'Use an HTTPS image URL.');
      requireValue(typeof data.available === 'boolean', 'Select item availability.');
      const values = [category, field(data.name, 'Item name', 80),
        field(data.description, 'Description', 400), image,
        integer(data.price, 'Price in paise', 1, 10000000), Number(data.available)];
      if (!id) return Number(db.run(`INSERT INTO items(category_id,name,description,image,price,available)
        VALUES (?,?,?,?,?,?)`, ...values).lastInsertRowid);
      item(id);
      db.run(`UPDATE items SET category_id=?,name=?,description=?,image=?,price=?,available=? WHERE id=?`,
        ...values, id);
      return id;
    },
    // Restrict the staff operation to the sold-out flag. Historical orders keep their snapshots.
    setAvailability(id, available) {
      requireValue(typeof available === 'boolean', 'Select item availability.');
      item(id);
      db.run('UPDATE items SET available=? WHERE id=?', Number(available), id);
    },
    // Keep the row for historical order-line references.
    archiveItem(id) {
      item(id);
      db.run('UPDATE items SET archived=1, available=0 WHERE id=?', id);
    }
  };
}

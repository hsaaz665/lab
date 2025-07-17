const express = require('express');
const router = express.Router();
const Joi = require('joi');

{% if values.database == "mongodb" %}
const mongoose = require('mongoose');

// Example schema for MongoDB
const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Item = mongoose.model('Item', ItemSchema);
{% elif values.database == "postgresql" or values.database == "mysql" %}
const knex = require('knex');
const dbConfig = require('../config/database');
const db = knex(dbConfig);
{% endif %}

// Validation schemas
const createItemSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  description: Joi.string().optional().max(500),
  status: Joi.string().valid('active', 'inactive').default('active')
});

const updateItemSchema = Joi.object({
  name: Joi.string().optional().min(1).max(100),
  description: Joi.string().optional().max(500),
  status: Joi.string().valid('active', 'inactive').optional()
});

// Middleware for validation
const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(detail => detail.message)
      });
    }
    req.body = value;
    next();
  };
};

// GET /api/v1/items - Get all items
router.get('/items', async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    {% if values.database == "mongodb" %}
    const filter = status ? { status } : {};
    const items = await Item.find(filter)
      .limit(limit * 1)
      .skip(offset)
      .sort({ createdAt: -1 });
    const total = await Item.countDocuments(filter);
    {% elif values.database == "postgresql" or values.database == "mysql" %}
    let query = db('items').select('*').orderBy('created_at', 'desc');
    
    if (status) {
      query = query.where('status', status);
    }
    
    const items = await query.limit(limit).offset(offset);
    const [{ count }] = await db('items').count('* as count').where(status ? { status } : {});
    const total = parseInt(count);
    {% endif %}

    res.json({
      data: items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// GET /api/v1/items/:id - Get item by ID
router.get('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;

    {% if values.database == "mongodb" %}
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }
    
    const item = await Item.findById(id);
    {% elif values.database == "postgresql" or values.database == "mysql" %}
    const [item] = await db('items').where('id', id);
    {% endif %}

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ data: item });
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// POST /api/v1/items - Create new item
router.post('/items', validateBody(createItemSchema), async (req, res) => {
  try {
    {% if values.database == "mongodb" %}
    const item = new Item(req.body);
    await item.save();
    {% elif values.database == "postgresql" or values.database == "mysql" %}
    const [id] = await db('items').insert({
      ...req.body,
      created_at: new Date(),
      updated_at: new Date()
    });
    const [item] = await db('items').where('id', id);
    {% endif %}

    res.status(201).json({
      message: 'Item created successfully',
      data: item
    });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// PUT /api/v1/items/:id - Update item
router.put('/items/:id', validateBody(updateItemSchema), async (req, res) => {
  try {
    const { id } = req.params;

    {% if values.database == "mongodb" %}
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }
    
    const item = await Item.findByIdAndUpdate(
      id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    {% elif values.database == "postgresql" or values.database == "mysql" %}
    await db('items').where('id', id).update({
      ...req.body,
      updated_at: new Date()
    });
    const [item] = await db('items').where('id', id);
    {% endif %}

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({
      message: 'Item updated successfully',
      data: item
    });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/v1/items/:id - Delete item
router.delete('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;

    {% if values.database == "mongodb" %}
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }
    
    const item = await Item.findByIdAndDelete(id);
    {% elif values.database == "postgresql" or values.database == "mysql" %}
    const deletedCount = await db('items').where('id', id).del();
    const item = deletedCount > 0;
    {% endif %}

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

module.exports = router;

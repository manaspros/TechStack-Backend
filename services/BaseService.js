// filepath: /run/media/manas/New Volume/Code/OOPS/TechStack-Backend/services/BaseService.js
/**
 * BaseService - Abstract base class for all services
 * Provides common functionality and enforces consistent interface
 */
class BaseService {
  /**
   * Constructor for the base service
   * @param {Object} model - The data model this service will operate on
   */
  constructor(model) {
    // Prevent direct instantiation of the abstract class
    if (new.target === BaseService) {
      throw new Error('BaseService is an abstract class and cannot be instantiated directly.');
    }
    
    this.model = model;
    this.initialize();
  }

  /**
   * Initialize method for service-specific setup
   * Should be overridden by subclasses if needed
   */
  initialize() {
    // To be implemented by subclasses if needed
  }

  /**
   * Get all items with pagination
   * @param {Object} filter - The filter criteria
   * @param {Number} limit - Maximum number of items to return
   * @param {Number} page - Page number for pagination
   * @returns {Promise} Items and pagination info
   */
  async getAll(filter = {}, limit = 20, page = 1) {
    try {
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const items = await this.model.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
        
      const total = await this.model.countDocuments(filter);
      
      return {
        items,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        }
      };
    } catch (error) {
      console.error(`Error in getAll ${this.constructor.name}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific item by ID
   * @param {string} id - The item ID
   * @returns {Promise} The found item
   */
  async getById(id) {
    try {
      const item = await this.model.findById(id);
      
      if (!item) {
        throw new Error('Item not found');
      }
      
      return item;
    } catch (error) {
      console.error(`Error in getById ${this.constructor.name}:`, error);
      throw error;
    }
  }

  /**
   * Create a new item
   * @param {Object} data - Item data
   * @returns {Promise} The created item
   */
  async create(data) {
    try {
      const item = new this.model(data);
      await item.save();
      return item;
    } catch (error) {
      console.error(`Error in create ${this.constructor.name}:`, error);
      throw error;
    }
  }

  /**
   * Update an existing item
   * @param {string} id - The item ID
   * @param {Object} data - New data to update
   * @returns {Promise} The updated item
   */
  async update(id, data) {
    try {
      const item = await this.model.findById(id);
      
      if (!item) {
        throw new Error('Item not found');
      }
      
      Object.assign(item, data);
      await item.save();
      
      return item;
    } catch (error) {
      console.error(`Error in update ${this.constructor.name}:`, error);
      throw error;
    }
  }

  /**
   * Delete an item
   * @param {string} id - The item ID
   * @returns {Promise} Result of the deletion operation
   */
  async delete(id) {
    try {
      const result = await this.model.deleteOne({ _id: id });
      
      if (result.deletedCount === 0) {
        throw new Error('Item not found');
      }
      
      return { success: true, deletedId: id };
    } catch (error) {
      console.error(`Error in delete ${this.constructor.name}:`, error);
      throw error;
    }
  }
}

export default BaseService;
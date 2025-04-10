// filepath: /run/media/manas/New Volume/Code/OOPS/TechStack-Backend/controllers/BaseController.js
/**
 * BaseController - Abstract base class for all controllers
 * Provides common functionality for handling HTTP requests
 */
class BaseController {
  /**
   * Constructor for the base controller
   * @param {Object} service - The service this controller will use
   */
  constructor(service) {
    // Prevent direct instantiation of the abstract class
    if (new.target === BaseController) {
      throw new Error('BaseController is an abstract class and cannot be instantiated directly.');
    }
    
    this.service = service;
  }

  /**
   * Send a successful response
   * @protected
   * @param {Object} res - Express response object
   * @param {*} data - Data to send in the response
   * @param {Number} status - HTTP status code (default: 200)
   * @param {String} message - Optional success message
   */
  sendSuccess(res, data = {}, status = 200, message = null) {
    const response = { success: true };
    
    if (message) {
      response.message = message;
    }
    
    if (typeof data === 'object' && data !== null) {
      Object.assign(response, data);
    } else {
      response.data = data;
    }
    
    return res.status(status).json(response);
  }
  
  /**
   * Send an error response
   * @protected
   * @param {Object} res - Express response object
   * @param {Error|String} error - Error object or message
   * @param {Number} status - HTTP status code (default: 500)
   */
  sendError(res, error, status = 500) {
    console.error(`Error in ${this.constructor.name}:`, error);
    
    const errorMessage = error instanceof Error ? error.message : error;
    const response = {
      success: false,
      error: errorMessage
    };
    
    return res.status(status).json(response);
  }
  
  /**
   * Validate required fields in a request
   * @protected
   * @param {Object} req - Express request object
   * @param {Array} fields - Array of field names to validate
   * @param {String} source - Request property to check (body, params, query)
   * @throws {Error} If any required field is missing
   */
  validateRequiredFields(req, fields, source = 'body') {
    const missingFields = fields.filter(field => !req[source][field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
  }
  
  /**
   * Get a value from a request with fallbacks
   * @protected
   * @param {Object} req - Express request object
   * @param {String} fieldName - Name of the field to get
   * @param {Array} sources - Request properties to check in order (default: ['body', 'params', 'query'])
   * @param {*} defaultValue - Default value to return if field not found
   * @returns {*} The field value or default value
   */
  getRequestField(req, fieldName, sources = ['body', 'params', 'query'], defaultValue = undefined) {
    for (const source of sources) {
      if (req[source] && req[source][fieldName] !== undefined) {
        return req[source][fieldName];
      }
    }
    
    return defaultValue;
  }
}

export default BaseController;
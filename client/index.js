/**
 * BROP Client Library
 * 
 * A client library for interacting with the BROP (Browser Remote Operations Protocol) bridge service.
 * Provides high-level abstractions for browser automation with automatic tab lifecycle management.
 */

const { Page, createPage } = require('./page');
const { createNamedBROPConnection, createBROPConnection, getCurrentTestName } = require('./connection');

module.exports = {
  // High-level Page API
  Page,
  createPage,
  
  // Low-level connection API
  createNamedBROPConnection,
  createBROPConnection,
  getCurrentTestName
};
// Common property extraction utilities for personalized products

class PropertyExtractor {
  static extractJarMessage(properties) {
    try {
      const propertiesArray = typeof properties === 'string' ? JSON.parse(properties) : properties;
      
      if (!Array.isArray(propertiesArray)) {
        return null;
      }
      
      // First look for 'Jar_Message'
      for (const prop of propertiesArray) {
        if (prop.name === 'Jar_Message' && prop.value) {
          return prop.value;
        }
      }
      
      // Fallback to 'message'
      for (const prop of propertiesArray) {
        if (prop.name === 'message' && prop.value) {
          return prop.value;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting jar message:', error);
      return null;
    }
  }

  static extractCandlesPlantMessage(properties) {
    try {
      const propertiesArray = typeof properties === 'string' ? JSON.parse(properties) : properties;
      
      if (!Array.isArray(propertiesArray)) {
        return null;
      }
      
      // Look for 'message' only
      for (const prop of propertiesArray) {
        if (prop.name === 'message' && prop.value) {
          return prop.value;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting candles/plant message:', error);
      return null;
    }
  }

  static extractProseccoMessage(properties) {
    try {
      const propertiesArray = typeof properties === 'string' ? JSON.parse(properties) : properties;
      
      if (!Array.isArray(propertiesArray)) {
        return null;
      }
      
      // Look for 'message' only
      for (const prop of propertiesArray) {
        if (prop.name === 'message' && prop.value) {
          return prop.value;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting prosecco message:', error);
      return null;
    }
  }

  static extractPolaroidMessage(properties) {
    try {
      const propertiesArray = typeof properties === 'string' ? JSON.parse(properties) : properties;
      
      if (!Array.isArray(propertiesArray)) {
        return null;
      }
      
      // Look for 'Personalised Polaroid' first, then 'image'
      for (const prop of propertiesArray) {
        if (prop.name === 'Personalised Polaroid' && prop.value) {
          return prop.value;
        }
      }
      
      // Fallback to 'image'
      for (const prop of propertiesArray) {
        if (prop.name === 'image' && prop.value) {
          return prop.value;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting polaroid message:', error);
      return null;
    }
  }

  static cleanMessage(messageValue) {
    if (!messageValue) return null;
    
    try {
      // Try to parse if it's JSON
      const parsedMessage = JSON.parse(messageValue);
      return parsedMessage.replace(/\s+/g, ' ').trim();
    } catch (error) {
      // If not JSON, just clean the string
      return messageValue.replace(/\s+/g, ' ').trim();
    }
  }
}

module.exports = PropertyExtractor;
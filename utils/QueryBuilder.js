const DateHelper = require('./DateHelper');

class QueryBuilder {
  static buildDynamicQuery(baseQuery, params, scriptKey) {
    let query = baseQuery;
    const queryParams = [];
    
    console.log('Building dynamic query for:', scriptKey);

    // Handle FOS_update script specially
    if (scriptKey === 'fos_update') {
      if (params.orderNumbers && params.orderNumbers.length > 0) {
        const orderNumberPlaceholders = params.orderNumbers.map(() => '?').join(',');
        query = query.replace('PLACEHOLDER_ORDER_NUMBERS', orderNumberPlaceholders);
        queryParams.push(...params.orderNumbers);
        console.log(`FOS_update: Built query for ${params.orderNumbers.length} order numbers`);
      } else {
        // If no order numbers, create a query that won't affect any rows
        query = query.replace('PLACEHOLDER_ORDER_NUMBERS', "'NO_ORDERS'");
        console.log('FOS_update: No order numbers provided, using placeholder');
      }
      return { query, params: queryParams };
    }
    
    // Handle packing_message script specially
    if (scriptKey === 'packing_message') {
      // Add delivery date parameter
      if (params.date) {
        const deliveryDate = DateHelper.formatDate(params.date);
        queryParams.push(deliveryDate);
      }
      
      // Add order numbers filter if provided
      if (params.orderNumbers && params.orderNumbers.length > 0) {
        const orderNumberPlaceholders = params.orderNumbers.map(() => '?').join(',');
        query = query.replace(/ORDER BY/i, `AND so.order_number IN (${orderNumberPlaceholders}) ORDER BY`);
        queryParams.push(...params.orderNumbers);
        console.log(`Packing-Message: Built query for ${params.orderNumbers.length} order numbers`);
      }
      
      return { query, params: queryParams };
    }
    
    // Handle date parameter for other scripts (including orders)
    if (params.date && baseQuery.includes('sode.delivery_date') && scriptKey !== 'personalized' && scriptKey !== 'gopeople' && scriptKey !== 'auspost') {
      const deliveryDate = DateHelper.formatDate(params.date);

      const whereIndex = query.toLowerCase().indexOf('where');
      if (whereIndex !== -1) {
        const beforeWhere = query.substring(0, whereIndex);
        const fromWhere = query.substring(whereIndex);

        const orderByIndex = fromWhere.toLowerCase().indexOf('order by');
        let whereClause, afterOrderBy;

        if (orderByIndex !== -1) {
          whereClause = fromWhere.substring(0, orderByIndex);
          afterOrderBy = fromWhere.substring(orderByIndex);
        } else {
          whereClause = fromWhere;
          afterOrderBy = '';
        }

        whereClause = whereClause.replace(/sode\.delivery_date\s*=\s*'[^']*'/, 'sode.delivery_date = ?');

        query = beforeWhere + whereClause + afterOrderBy;
        queryParams.push(deliveryDate);
      }
    }

    // Handle orders script specially - replace is_same_day and shop_ids placeholders AFTER date parameter
    if (scriptKey === 'orders') {
      // Handle shop_ids placeholder
      if (params.shop_id_filter) {
        console.log(`Orders: Replacing shop_ids placeholder with value: ${params.shop_id_filter}`);
        query = query.replace('PLACEHOLDER_SHOP_IDS', params.shop_id_filter);
      } else {
        // Default to shop_id = 10 (LVLY) if not provided
        console.log('Orders: shop_id_filter not provided, defaulting to 10 (LVLY)');
        query = query.replace('PLACEHOLDER_SHOP_IDS', '10');
      }

      if (params.is_same_day !== undefined) {
        console.log(`Orders: Replacing is_same_day placeholder with value: ${params.is_same_day}`);
        query = query.replace('PLACEHOLDER_IS_SAME_DAY', '?');
        queryParams.push(params.is_same_day);
      } else {
        // Default to 1 (GoPeople) if not provided
        console.log('Orders: is_same_day not provided, defaulting to 1 (GoPeople)');
        query = query.replace('PLACEHOLDER_IS_SAME_DAY', '?');
        queryParams.push('1');
      }
    }
    
    // Handle location parameter
    if (params.location && params.location.trim()) {
      if (scriptKey === 'orders') {
        query = query.replace(
          /sfl\.location_name\s+IN\s+\([^)]+\)/g, 
          'sfl.location_name = ?'
        );
      } else {
        const mainWhereMatch = query.match(/(WHERE[\s\S]*?)(ORDER BY|$)/i);
        if (mainWhereMatch) {
          const beforeOrderBy = query.lastIndexOf(mainWhereMatch[2]);
          const insertPoint = beforeOrderBy !== -1 ? beforeOrderBy : query.length;
          
          const beforeWhere = query.substring(0, insertPoint);
          const afterWhere = query.substring(insertPoint);
          
          query = beforeWhere + ' AND sfl.location_name = ? ' + afterWhere;
        }
      }
      queryParams.push(params.location.trim());
    }
    
    // Handle order numbers parameter for personalized, gopeople, and auspost scripts
    if (params.orderNumbers && params.orderNumbers.length > 0) {
      if (scriptKey === 'personalized') {
        console.log('Adding order numbers filter for personalized:', params.orderNumbers.length, 'orders');

        const orderNumberPlaceholders = params.orderNumbers.map(() => '?').join(',');

        const mainWhereMatch = query.match(/(WHERE[\s\S]*?)(ORDER BY|$)/i);
        if (mainWhereMatch) {
          const beforeOrderBy = query.lastIndexOf(mainWhereMatch[2]);
          const insertPoint = beforeOrderBy !== -1 ? beforeOrderBy : query.length;

          const beforeWhere = query.substring(0, insertPoint);
          const afterWhere = query.substring(insertPoint);

          query = beforeWhere + ` AND so.order_number IN (${orderNumberPlaceholders}) ` + afterWhere;
          queryParams.push(...params.orderNumbers);
        }
      } else if (scriptKey === 'gopeople') {
        console.log('Adding order numbers filter for gopeople:', params.orderNumbers.length, 'orders');

        const orderNumberPlaceholders = params.orderNumbers.map(() => '?').join(',');

        const mainWhereMatch = query.match(/(WHERE[\s\S]*?)(ORDER BY|$)/i);
        if (mainWhereMatch) {
          const beforeOrderBy = query.lastIndexOf(mainWhereMatch[2]);
          const insertPoint = beforeOrderBy !== -1 ? beforeOrderBy : query.length;

          const beforeWhere = query.substring(0, insertPoint);
          const afterWhere = query.substring(insertPoint);

          query = beforeWhere + ` AND so.order_number IN (${orderNumberPlaceholders}) ` + afterWhere;
          queryParams.push(...params.orderNumbers);
        }
      } else if (scriptKey === 'auspost') {
        console.log('Adding order numbers filter for auspost:', params.orderNumbers.length, 'orders');

        const orderNumberPlaceholders = params.orderNumbers.map(() => '?').join(',');

        const mainWhereMatch = query.match(/(WHERE[\s\S]*?)(ORDER BY|$)/i);
        if (mainWhereMatch) {
          const beforeOrderBy = query.lastIndexOf(mainWhereMatch[2]);
          const insertPoint = beforeOrderBy !== -1 ? beforeOrderBy : query.length;

          const beforeWhere = query.substring(0, insertPoint);
          const afterWhere = query.substring(insertPoint);

          query = beforeWhere + ` AND so.order_number IN (${orderNumberPlaceholders}) ` + afterWhere;
          queryParams.push(...params.orderNumbers);
        }
      }
    }
    
    return { query, params: queryParams };
  }
}

module.exports = QueryBuilder;
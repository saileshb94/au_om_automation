const DateHelper = require('./DateHelper');
const { ORDERS_QUERY_CONFIG } = require('../config');

class QueryBuilder {
  static buildDynamicQuery(baseQuery, params, scriptKey) {
    let query = baseQuery;
    const queryParams = [];
    
    console.log('Building dynamic query for:', scriptKey);

    // Handle FOS_update script specially - supports both successful and unsuccessful order updates
    if (scriptKey === 'fos_update') {
      // Check if this is for successful orders
      if (params.successfulOrderIds && params.successfulOrderIds.length > 0) {
        const orderIdPlaceholders = params.successfulOrderIds.map(() => '?').join(',');
        query = query.replace('PLACEHOLDER_SUCCESSFUL_ORDER_IDS', orderIdPlaceholders);
        queryParams.push(...params.successfulOrderIds);
        console.log(`FOS_update (Successful): Built query for ${params.successfulOrderIds.length} order IDs`);
      } else if (query.includes('PLACEHOLDER_SUCCESSFUL_ORDER_IDS')) {
        // If no successful order IDs, create a query that won't affect any rows
        query = query.replace('PLACEHOLDER_SUCCESSFUL_ORDER_IDS', '0');
        console.log('FOS_update (Successful): No order IDs provided, using placeholder');
      }

      // Check if this is for unsuccessful orders
      if (params.unsuccessfulOrderIds && params.unsuccessfulOrderIds.length > 0) {
        const orderIdPlaceholders = params.unsuccessfulOrderIds.map(() => '?').join(',');
        query = query.replace('PLACEHOLDER_UNSUCCESSFUL_ORDER_IDS', orderIdPlaceholders);
        queryParams.push(...params.unsuccessfulOrderIds);
        console.log(`FOS_update (Unsuccessful): Built query for ${params.unsuccessfulOrderIds.length} order IDs`);
      } else if (query.includes('PLACEHOLDER_UNSUCCESSFUL_ORDER_IDS')) {
        // If no unsuccessful order IDs, create a query that won't affect any rows
        query = query.replace('PLACEHOLDER_UNSUCCESSFUL_ORDER_IDS', '0');
        console.log('FOS_update (Unsuccessful): No order IDs provided, using placeholder');
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

      // Add order IDs filter if provided
      if (params.orderIds && params.orderIds.length > 0) {
        const orderIdPlaceholders = params.orderIds.map(() => '?').join(',');
        // Insert filter in WHERE clause (before GROUP BY), not after
        query = query.replace(/(WHERE[\s\S]*?)(GROUP BY)/i, `$1 AND so.id IN (${orderIdPlaceholders}) $2`);
        queryParams.push(...params.orderIds);
        console.log(`Packing-Message: Built query for ${params.orderIds.length} order IDs`);
      }

      return { query, params: queryParams };
    }
    
    // Handle date parameter for other scripts (excluding orders which has explicit placeholder handling)
    if (params.date && baseQuery.includes('sode.delivery_date') && scriptKey !== 'personalized' && scriptKey !== 'gopeople' && scriptKey !== 'auspost' && scriptKey !== 'orders') {
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

    // Handle orders script specially - replace delivery_date, is_same_day and shop_ids placeholders
    if (scriptKey === 'orders') {
      console.log('\n🔧 === ORDERS QUERY BUILDER DEBUG ===');
      console.log('Params received:', { date: params.date, is_same_day: params.is_same_day, shop_id_filter: params.shop_id_filter });

      // Handle shop_ids placeholder
      if (params.shop_id_filter) {
        console.log(`Orders: Replacing shop_ids placeholder with value: ${params.shop_id_filter}`);
        query = query.replace('PLACEHOLDER_SHOP_IDS', params.shop_id_filter);
      } else {
        // Default to shop_id = 10 (LVLY) if not provided
        console.log('Orders: shop_id_filter not provided, defaulting to 10 (LVLY)');
        query = query.replace('PLACEHOLDER_SHOP_IDS', '10');
      }
      console.log('After SHOP_IDS replacement, query includes:', query.includes('PLACEHOLDER_SHOP_IDS') ? 'PLACEHOLDER_SHOP_IDS still present!' : 'PLACEHOLDER_SHOP_IDS replaced ✓');

      // Handle delivery_date placeholder - REPLACE WITH QUOTES!
      if (params.date) {
        const deliveryDate = DateHelper.formatDate(params.date);
        console.log(`Orders: Replacing delivery_date placeholder with value: ${deliveryDate}`);
        console.log('Before replacement, query includes:', query.includes("'PLACEHOLDER_DELIVERY_DATE'") ? "'PLACEHOLDER_DELIVERY_DATE' found" : 'NOT FOUND');
        query = query.replace("'PLACEHOLDER_DELIVERY_DATE'", '?');
        queryParams.push(deliveryDate);
        console.log('After replacement, query includes:', query.includes("'PLACEHOLDER_DELIVERY_DATE'") ? "'PLACEHOLDER_DELIVERY_DATE' still present!" : 'Replaced ✓');
      } else {
        // Should not happen, but handle gracefully
        console.warn('Orders: delivery_date not provided, this may cause issues');
        query = query.replace("'PLACEHOLDER_DELIVERY_DATE'", '?');
        queryParams.push(null);
      }

      // Handle is_same_day placeholder
      if (params.is_same_day !== undefined) {
        console.log(`Orders: Replacing is_same_day placeholder with value: ${params.is_same_day}`);
        console.log('Before replacement, query includes:', query.includes('PLACEHOLDER_IS_SAME_DAY') ? 'PLACEHOLDER_IS_SAME_DAY found' : 'NOT FOUND');
        query = query.replace('PLACEHOLDER_IS_SAME_DAY', '?');
        queryParams.push(params.is_same_day);
        console.log('After replacement, query includes:', query.includes('PLACEHOLDER_IS_SAME_DAY') ? 'PLACEHOLDER_IS_SAME_DAY still present!' : 'Replaced ✓');
      } else {
        // Default to 1 (GoPeople) if not provided
        console.log('Orders: is_same_day not provided, defaulting to 1 (GoPeople)');
        query = query.replace('PLACEHOLDER_IS_SAME_DAY', '?');
        queryParams.push('1');
      }

      // Handle order limit placeholder
      if (params.isManualProcessing === true) {
        console.log(`Orders: Manual processing mode - removing order limit (setting to ${ORDERS_QUERY_CONFIG.manualModeLimit})`);
        query = query.replace('PLACEHOLDER_ORDER_LIMIT', String(ORDERS_QUERY_CONFIG.manualModeLimit));
      } else {
        console.log(`Orders: Automatic processing mode - applying ${ORDERS_QUERY_CONFIG.automaticModeLimit} order limit per location`);
        query = query.replace('PLACEHOLDER_ORDER_LIMIT', String(ORDERS_QUERY_CONFIG.automaticModeLimit));
      }

      console.log('Final queryParams array:', queryParams);
      console.log('=== END ORDERS QUERY BUILDER DEBUG ===\n');
    }

    // Handle manual orderIds filter for orders script (manual processing mode)
    if (scriptKey === 'orders' && params.orderIds && params.orderIds.length > 0) {
      console.log(`Orders: Adding manual orderIds filter for ${params.orderIds.length} orders`);
      // Find the subquery WHERE clause and add orderIds filter before the location_name filter
      const subqueryPattern = /(WHERE[\s\S]*?)(AND sfl\.location_name)/i;
      if (subqueryPattern.test(query)) {
        const orderIdPlaceholders = params.orderIds.map(() => '?').join(',');
        query = query.replace(
          subqueryPattern,
          `$1 AND so.id IN (${orderIdPlaceholders}) $2`
        );
        queryParams.push(...params.orderIds);
        console.log(`Orders: Inserted orderIds filter with ${params.orderIds.length} IDs into subquery`);
      } else {
        console.warn('Orders: Could not find WHERE clause pattern to insert orderIds filter');
      }
    }

    // Handle location parameter - supports multiple locations (comma-separated)
    if (params.hasLocationFilter && params.locations && params.locations.length > 0) {
      if (scriptKey === 'orders') {
        // For orders script: replace the hardcoded IN clause with dynamic locations
        const locationPlaceholders = params.locations.map(() => '?').join(',');
        console.log(`Orders: Replacing location_name IN clause with ${params.locations.length} location(s): ${params.locations.join(', ')}`);
        query = query.replace(
          /sfl\.location_name\s+IN\s+\([^)]+\)/g,
          `sfl.location_name IN (${locationPlaceholders})`
        );
        queryParams.push(...params.locations);
      } else {
        // For other scripts: add location filter to WHERE clause
        const mainWhereMatch = query.match(/(WHERE[\s\S]*?)(ORDER BY|$)/i);
        if (mainWhereMatch) {
          const beforeOrderBy = query.lastIndexOf(mainWhereMatch[2]);
          const insertPoint = beforeOrderBy !== -1 ? beforeOrderBy : query.length;

          const beforeWhere = query.substring(0, insertPoint);
          const afterWhere = query.substring(insertPoint);

          if (params.locations.length === 1) {
            // Single location: use = operator
            console.log(`Adding single location filter: ${params.locations[0]}`);
            query = beforeWhere + ' AND sfl.location_name = ? ' + afterWhere;
            queryParams.push(params.locations[0]);
          } else {
            // Multiple locations: use IN operator
            const locationPlaceholders = params.locations.map(() => '?').join(',');
            console.log(`Adding multiple location filter: ${params.locations.join(', ')}`);
            query = beforeWhere + ` AND sfl.location_name IN (${locationPlaceholders}) ` + afterWhere;
            queryParams.push(...params.locations);
          }
        }
      }
    } else if (scriptKey === 'orders') {
      // For orders script with no location filter: keep the hardcoded IN clause as-is
      console.log('Orders: No location filter specified, using all locations from hardcoded IN clause');
    }
    
    // Handle order IDs parameter for personalized, gopeople, and auspost scripts
    if (params.orderIds && params.orderIds.length > 0) {
      if (scriptKey === 'personalized') {
        console.log('Adding order IDs filter for personalized:', params.orderIds.length, 'orders');

        const orderIdPlaceholders = params.orderIds.map(() => '?').join(',');

        const mainWhereMatch = query.match(/(WHERE[\s\S]*?)(ORDER BY|$)/i);
        if (mainWhereMatch) {
          const beforeOrderBy = query.lastIndexOf(mainWhereMatch[2]);
          const insertPoint = beforeOrderBy !== -1 ? beforeOrderBy : query.length;

          const beforeWhere = query.substring(0, insertPoint);
          const afterWhere = query.substring(insertPoint);

          query = beforeWhere + ` AND so.id IN (${orderIdPlaceholders}) ` + afterWhere;
          queryParams.push(...params.orderIds);
        }
      } else if (scriptKey === 'gopeople') {
        console.log('Adding order IDs filter for gopeople:', params.orderIds.length, 'orders');

        const orderIdPlaceholders = params.orderIds.map(() => '?').join(',');

        const mainWhereMatch = query.match(/(WHERE[\s\S]*?)(ORDER BY|$)/i);
        if (mainWhereMatch) {
          const beforeOrderBy = query.lastIndexOf(mainWhereMatch[2]);
          const insertPoint = beforeOrderBy !== -1 ? beforeOrderBy : query.length;

          const beforeWhere = query.substring(0, insertPoint);
          const afterWhere = query.substring(insertPoint);

          query = beforeWhere + ` AND so.id IN (${orderIdPlaceholders}) ` + afterWhere;
          queryParams.push(...params.orderIds);
        }
      } else if (scriptKey === 'auspost') {
        console.log('Adding order IDs filter for auspost:', params.orderIds.length, 'orders');

        const orderIdPlaceholders = params.orderIds.map(() => '?').join(',');

        const mainWhereMatch = query.match(/(WHERE[\s\S]*?)(ORDER BY|$)/i);
        if (mainWhereMatch) {
          const beforeOrderBy = query.lastIndexOf(mainWhereMatch[2]);
          const insertPoint = beforeOrderBy !== -1 ? beforeOrderBy : query.length;

          const beforeWhere = query.substring(0, insertPoint);
          const afterWhere = query.substring(insertPoint);

          query = beforeWhere + ` AND so.id IN (${orderIdPlaceholders}) ` + afterWhere;
          queryParams.push(...params.orderIds);
        }
      }
    }
    
    return { query, params: queryParams };
  }
}

module.exports = QueryBuilder;
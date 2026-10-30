/**
 * VendSphere Enterprise Risk Management Engine
 * Dynamically computes and telemetry-monitors:
 * 1. Vendor Delays & Supply Chain Reliability
 * 2. Price Fluctuation & Cost Volatility Exposure
 * 3. Procurement Bottlenecks & Approval Cycle Velocity
 */

export const assessProcurementRisks = async (db) => {
  const now = new Date();

  // ========================================================
  // 1. VENDOR DELAYS & DELIVERY RISK ASSESSMENT
  // ========================================================
  const activeOrdersRes = await db.query(
    `SELECT po.id, po.po_number, po.total_amount, po.status, po.created_at,
            v.id as vendor_id, v.name as vendor_name, v.email as vendor_email,
            v.performance_score, v.rating as vendor_rating,
            q.delivery_days, q.total_cost as quoted_cost
     FROM purchase_orders po
     JOIN vendors v ON po.vendor_id = v.id
     LEFT JOIN quotations q ON po.quotation_id = q.id
     WHERE po.status IN ('Sent to Vendor', 'Accepted')`
  );

  const vendorDelayRisks = [];
  let delayedOrdersCount = 0;
  let totalDelayExposure = 0;

  for (const po of activeOrdersRes.rows) {
    const orderDate = new Date(po.created_at);
    const promisedDays = parseInt(po.delivery_days, 10) || 7;
    const dueDate = new Date(orderDate.getTime() + promisedDays * 24 * 60 * 60 * 1000);
    const daysElapsed = Math.ceil((now - orderDate) / (1000 * 60 * 60 * 24));
    const overdueDays = daysElapsed - promisedDays;
    const poAmount = parseFloat(po.total_amount) || 0;

    let severity = null;
    let impactScore = 40;

    if (overdueDays > 7) {
      severity = 'Critical';
      impactScore = 92;
    } else if (overdueDays >= 3) {
      severity = 'High';
      impactScore = 78;
    } else if (overdueDays >= 1) {
      severity = 'Medium';
      impactScore = 60;
    } else if (po.performance_score < 75 && overdueDays >= 0) {
      // Impending delay based on poor vendor scorecard
      severity = 'Medium';
      impactScore = 55;
    } else if (po.performance_score < 60) {
      severity = 'Low';
      impactScore = 42;
    }

    if (severity) {
      delayedOrdersCount++;
      totalDelayExposure += poAmount;

      vendorDelayRisks.push({
        risk_type: 'VENDOR_DELAY',
        severity,
        title: overdueDays > 0 
          ? `Delivery Delay: ${po.po_number} with ${po.vendor_name} (${overdueDays}d overdue)`
          : `At-Risk Fulfillment: ${po.po_number} (${po.vendor_name} score: ${po.performance_score}/100)`,
        description: overdueDays > 0
          ? `Purchase Order ${po.po_number} was promised within ${promisedDays} days but has exceeded deadline by ${overdueDays} days. Risk of production or operational disruption.`
          : `Vendor ${po.vendor_name} has a historical performance score of ${po.performance_score}/100 and is within 24h of the promised delivery milestone.`,
        entity_type: 'PURCHASE_ORDER',
        entity_id: po.id,
        impact_score: impactScore,
        financial_exposure: poAmount,
        status: 'Active',
        metadata: {
          poNumber: po.po_number,
          vendorName: po.vendor_name,
          vendorId: po.vendor_id,
          promisedDays,
          daysElapsed,
          overdueDays: Math.max(0, overdueDays),
          dueDate: dueDate.toISOString(),
          performanceScore: po.performance_score
        }
      });
    }
  }

  // ========================================================
  // 2. PRICE FLUCTUATION & COST VOLATILITY ASSESSMENT
  // ========================================================
  const priceFluctuationRisks = [];
  let totalCostSurgeExposure = 0;

  // Compare Quotations unit pricing against PR estimated unit cost
  const priceComparisonRes = await db.query(
    `SELECT q.id as quotation_id, q.rfq_id, q.vendor_id, q.items as quoted_items, q.total_cost as quoted_total,
            rfq.rfq_number, rfq.title as rfq_title,
            pr.id as pr_id, pr.pr_number, pr.items as pr_items, pr.total_estimated_cost,
            v.name as vendor_name
     FROM quotations q
     JOIN rfqs rfq ON q.rfq_id = rfq.id
     JOIN purchase_requests pr ON rfq.purchase_request_id = pr.id
     JOIN vendors v ON q.vendor_id = v.id
     WHERE q.status IN ('Submitted', 'Accepted') AND q.created_at >= NOW() - INTERVAL '60 days'`
  );

  for (const row of priceComparisonRes.rows) {
    const prItems = Array.isArray(row.pr_items) ? row.pr_items : [];
    const quotedItems = Array.isArray(row.quoted_items) ? row.quoted_items : [];

    for (const qItem of quotedItems) {
      const qName = (qItem.name || qItem.item_name || '').toLowerCase().trim();
      const matchedPrItem = prItems.find(p => {
        const pName = (p.name || p.item_name || '').toLowerCase().trim();
        return pName && qName && (pName === qName || pName.includes(qName) || qName.includes(pName));
      });

      if (matchedPrItem) {
        const estCost = parseFloat(matchedPrItem.estimated_cost || matchedPrItem.estimated_unit_price || matchedPrItem.unit_price) || 1;
        const quotedCost = parseFloat(qItem.unit_price || qItem.estimated_cost || qItem.estimated_unit_price) || estCost;
        const qty = parseInt(qItem.quantity, 10) || parseInt(matchedPrItem.quantity, 10) || 1;

        const deltaCost = quotedCost - estCost;
        const deltaPct = Math.round(((quotedCost - estCost) / estCost) * 100);

        if (deltaPct >= 10) {
          const budgetExposure = Math.max(0, deltaCost * qty);
          totalCostSurgeExposure += budgetExposure;

          let severity = 'Medium';
          let impactScore = 55;

          if (deltaPct >= 30) {
            severity = 'Critical';
            impactScore = 90;
          } else if (deltaPct >= 20) {
            severity = 'High';
            impactScore = 75;
          } else if (deltaPct >= 10) {
            severity = 'Medium';
            impactScore = 58;
          }

          const itemName = qItem.name || qItem.item_name || matchedPrItem.name || matchedPrItem.item_name || 'Procured Item';

          priceFluctuationRisks.push({
            risk_type: 'PRICE_FLUCTUATION',
            severity,
            title: `Price Surge (+${deltaPct}%): ${itemName}`,
            description: `Quoted unit price from ${row.vendor_name} (₹${quotedCost.toFixed(2)}) surged by ${deltaPct}% over baseline budget estimate (₹${estCost.toFixed(2)}). Total budget variance: ₹${budgetExposure.toLocaleString()}.`,
            entity_type: 'ITEM',
            entity_id: row.quotation_id,
            impact_score: impactScore,
            financial_exposure: budgetExposure,
            status: 'Active',
            metadata: {
              itemName,
              category: matchedPrItem.category || 'General Goods',
              baselineUnitPrice: estCost,
              quotedUnitPrice: quotedCost,
              quantity: qty,
              priceDeltaPct: deltaPct,
              budgetVariance: budgetExposure,
              vendorName: row.vendor_name,
              rfqNumber: row.rfq_number
            }
          });
        }
      }
    }
  }

  // ========================================================
  // 3. PROCUREMENT BOTTLENECKS & APPROVAL VELOCITY
  // ========================================================
  const bottleneckRisks = [];
  let stalledRequestsCount = 0;

  // A. Stalled Requisitions (Pending Approval > 48h)
  const pendingPrsRes = await db.query(
    `SELECT pr.id, pr.pr_number, pr.title, pr.total_estimated_cost, pr.created_at, pr.status,
            u.name as requester_name, u.department,
            approver.name as current_approver_name
     FROM purchase_requests pr
     JOIN users u ON pr.requester_id = u.id
     LEFT JOIN users approver ON pr.current_approver_id = approver.id
     WHERE pr.status = 'Pending Approval'`
  );

  for (const pr of pendingPrsRes.rows) {
    const prDate = new Date(pr.created_at);
    const hoursElapsed = Math.round((now - prDate) / (1000 * 60 * 60));
    const daysElapsed = Math.floor(hoursElapsed / 24);

    if (hoursElapsed >= 48) {
      stalledRequestsCount++;
      const cost = parseFloat(pr.total_estimated_cost) || 0;

      let severity = 'Medium';
      let impactScore = 50;

      if (daysElapsed >= 6) {
        severity = 'Critical';
        impactScore = 88;
      } else if (daysElapsed >= 3) {
        severity = 'High';
        impactScore = 72;
      }

      bottleneckRisks.push({
        risk_type: 'PROCUREMENT_BOTTLENECK',
        severity,
        title: `Approval Bottleneck: ${pr.pr_number} (${daysElapsed}d pending)`,
        description: `Requisition "${pr.title}" submitted by ${pr.requester_name} (${pr.department}) has been delayed in approval for ${daysElapsed} days (${hoursElapsed} hours). Approver queue: ${pr.current_approver_name || 'Unassigned / Tier Review'}.`,
        entity_type: 'PURCHASE_REQUEST',
        entity_id: pr.id,
        impact_score: impactScore,
        financial_exposure: cost,
        status: 'Active',
        metadata: {
          prNumber: pr.pr_number,
          title: pr.title,
          requesterName: pr.requester_name,
          department: pr.department,
          approverName: pr.current_approver_name || 'Workflow Pool',
          hoursElapsed,
          daysElapsed,
          estimatedCost: cost
        }
      });
    }
  }

  // B. Stalled RFQs with Insufficient Bids
  const stalledRfqsRes = await db.query(
    `SELECT rfq.id, rfq.rfq_number, rfq.title, rfq.deadline, rfq.created_at,
            (SELECT COUNT(*) FROM quotations q WHERE q.rfq_id = rfq.id) as bid_count
     FROM rfqs rfq
     WHERE rfq.status = 'Open'`
  );

  for (const rfq of stalledRfqsRes.rows) {
    const deadline = new Date(rfq.deadline);
    const hoursToDeadline = Math.round((deadline - now) / (1000 * 60 * 60));
    const bidCount = parseInt(rfq.bid_count, 10) || 0;

    if (hoursToDeadline <= 48 && bidCount < 2) {
      bottleneckRisks.push({
        risk_type: 'PROCUREMENT_BOTTLENECK',
        severity: bidCount === 0 ? 'High' : 'Medium',
        title: `Sourcing Deficit: RFQ ${rfq.rfq_number} (${bidCount} bids received)`,
        description: `RFQ "${rfq.title}" closes in ${Math.max(1, hoursToDeadline)} hours but has received only ${bidCount} competitive quotation(s). Low competition may lead to unfavorable pricing.`,
        entity_type: 'RFQ',
        entity_id: rfq.id,
        impact_score: bidCount === 0 ? 76 : 58,
        financial_exposure: 0,
        status: 'Active',
        metadata: {
          rfqNumber: rfq.rfq_number,
          title: rfq.title,
          bidCount,
          hoursToDeadline: Math.max(0, hoursToDeadline),
          deadline: deadline.toISOString()
        }
      });
    }
  }

  // Combine All Risks
  const allIdentifiedRisks = [
    ...vendorDelayRisks,
    ...priceFluctuationRisks,
    ...bottleneckRisks
  ];

  // ========================================================
  // 4. AUTO-PERSIST REFRESH IN `procurement_risks` TABLE
  // ========================================================
  try {
    for (const r of allIdentifiedRisks) {
      // Upsert: check if an active risk with identical title and entity_id already exists
      const existing = await db.query(
        `SELECT id FROM procurement_risks 
         WHERE title = $1 AND entity_id = $2 AND status = 'Active'`,
        [r.title, r.entity_id]
      );

      if (existing.rows.length === 0) {
        await db.query(
          `INSERT INTO procurement_risks (
             risk_type, severity, title, description, entity_type, entity_id,
             impact_score, financial_exposure, status, metadata
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            r.risk_type,
            r.severity,
            r.title,
            r.description,
            r.entity_type,
            r.entity_id,
            r.impact_score,
            r.financial_exposure,
            'Active',
            JSON.stringify(r.metadata)
          ]
        );
      }
    }
  } catch (syncErr) {
    console.warn('[RiskEngine] Note: Risk auto-sync warning:', syncErr.message);
  }

  // ========================================================
  // 5. CALCULATE AGGREGATE RISK METRICS & SCORES
  // ========================================================
  const criticalCount = allIdentifiedRisks.filter(r => r.severity === 'Critical').length;
  const highCount = allIdentifiedRisks.filter(r => r.severity === 'High').length;
  const mediumCount = allIdentifiedRisks.filter(r => r.severity === 'Medium').length;
  const lowCount = allIdentifiedRisks.filter(r => r.severity === 'Low').length;

  // Composite 0-100 index weighted by severity
  const rawScore = (criticalCount * 28) + (highCount * 18) + (mediumCount * 8) + (lowCount * 3);
  const overallRiskScore = Math.min(98, Math.max(12, rawScore || 18));

  let riskLevel = 'Low';
  if (overallRiskScore >= 75) riskLevel = 'Critical';
  else if (overallRiskScore >= 60) riskLevel = 'High';
  else if (overallRiskScore >= 35) riskLevel = 'Moderate';

  const vendorDelayScore = Math.min(100, Math.max(15, (vendorDelayRisks.length * 20)));
  const priceVolatilityScore = Math.min(100, Math.max(10, (priceFluctuationRisks.length * 18)));
  const bottleneckScore = Math.min(100, Math.max(12, (bottleneckRisks.length * 22)));

  const totalBudgetAtRisk = totalDelayExposure + totalCostSurgeExposure;

  return {
    overallRiskScore,
    riskLevel,
    totalBudgetAtRisk,
    counts: {
      total: allIdentifiedRisks.length,
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
      vendorDelays: vendorDelayRisks.length,
      priceFluctuations: priceFluctuationRisks.length,
      bottlenecks: bottleneckRisks.length
    },
    scores: {
      vendorDelayScore,
      priceVolatilityScore,
      bottleneckScore
    },
    vendorDelayRisks,
    priceFluctuationRisks,
    bottleneckRisks,
    allRisks: allIdentifiedRisks
  };
};

export default {
  assessProcurementRisks
};

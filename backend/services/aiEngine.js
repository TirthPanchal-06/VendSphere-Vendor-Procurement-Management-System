// Vendor Bid Evaluation Engine
// Scores each bid across price, delivery, and reliability using weighted normalization.

export const evaluateVendorBids = (rfq, quotations) => {
  if (!quotations || quotations.length === 0) {
    return {
      enhancedQuotations: [],
      recommendedQuotationId: null,
      aiSummary: 'No bids submitted yet.'
    };
  }

  // Feature ranges
  const costs = quotations.map(q => parseFloat(q.total_cost || 0));
  const deliveryDays = quotations.map(q => parseInt(q.delivery_days || 0));

  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const minDelivery = Math.min(...deliveryDays);
  const maxDelivery = Math.max(...deliveryDays);

  // Score each bid
  const evaluatedBids = quotations.map(q => {
    const cost = parseFloat(q.total_cost || 0);
    const days = parseInt(q.delivery_days || 0);
    const rating = parseFloat(q.vendor_rating || 5.0);
    const perf = parseFloat(q.performance_score || 100);

    // Price — 45% weight
    let priceScore = 100;
    if (maxCost > minCost) {
      priceScore = 50 + 50 * ((maxCost - cost) / (maxCost - minCost));
    }

    // Delivery — 25% weight
    let deliveryScore = 100;
    if (maxDelivery > minDelivery) {
      deliveryScore = 60 + 40 * ((maxDelivery - days) / (maxDelivery - minDelivery));
    }

    // Vendor reliability — 30% weight
    const ratingNorm = (rating / 5.0) * 100;
    const reliability = (ratingNorm * 0.40) + (perf * 0.60);

    // Composite score
    const overallScore = Math.round(
      (priceScore * 0.45) + (deliveryScore * 0.25) + (reliability * 0.30)
    );

    // Strengths and risks
    const strengths = [];
    const risks = [];

    if (cost === minCost) {
      strengths.push('Lowest cost bid');
    } else {
      const diff = Math.round(((cost - minCost) / minCost) * 100);
      if (diff > 15) risks.push(`${diff}% above lowest bid`);
    }

    if (days === minDelivery) {
      strengths.push(`Fastest delivery (${days} days)`);
    } else if (days - minDelivery >= 3) {
      risks.push(`${days - minDelivery} days slower than fastest`);
    }

    if (reliability >= 90) {
      strengths.push(`Strong reliability (${Math.round(reliability)}%)`);
    } else if (reliability < 75) {
      risks.push(`Below-average reliability (${rating}/5.0)`);
    }

    return {
      ...q,
      aiMetrics: {
        overallScore,
        priceScore: Math.round(priceScore),
        deliveryScore: Math.round(deliveryScore),
        vendorReliability: Math.round(reliability),
        strengths,
        risks,
        isTopMatch: false
      }
    };
  });

  // Rank by overall score
  evaluatedBids.sort((a, b) => b.aiMetrics.overallScore - a.aiMetrics.overallScore);

  // Flag top result
  if (evaluatedBids.length > 0) {
    evaluatedBids[0].aiMetrics.isTopMatch = true;
  }

  const top = evaluatedBids[0];
  const aiSummary = top
    ? `Recommended: "${top.vendor_name}" — ${top.aiMetrics.overallScore}% match score. ${top.aiMetrics.strengths.slice(0, 2).join(', ')}.`
    : 'No recommendation available.';

  return {
    enhancedQuotations: evaluatedBids,
    recommendedQuotationId: top ? top.id : null,
    topVendorName: top ? top.vendor_name : null,
    topMatchScore: top ? top.aiMetrics.overallScore : 0,
    aiSummary
  };
};

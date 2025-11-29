import React from 'react';
import { CalcResult, CountryConfig, ProductConfig } from '../types';

interface ResultSectionProps {
  result: CalcResult;
  currentCountry: CountryConfig;
  currentProduct?: ProductConfig;
  salePrice: number;
  adRate: number;
  selectedBizCode: string;
  selectedSku: string;
}

const ResultSection: React.FC<ResultSectionProps> = ({
  result,
  currentCountry,
  currentProduct,
  salePrice,
  adRate,
  selectedBizCode,
  selectedSku
}) => {
  const handleExport = () => {
    if (!currentCountry || !currentProduct) return;
    const headers = [
      "BizCode",
      "SKU",
      "Sale Price",
      "Ad Rate",
      "Net Profit",
      "Margin",
      "Total Cost",
      "Purchase Cost",
      "Head Freight",
      "Last Mile",
      "Referral Fee",
      "Ad Cost",
      "Storage/Other",
      "Return Loss",
    ];
    const row = [
      selectedBizCode,
      selectedSku,
      salePrice,
      adRate,
      result.netProfit.toFixed(2),
      (result.margin * 100).toFixed(2) + "%",
      result.totalCost.toFixed(2),
      result.purchaseCost.toFixed(2),
      result.headFreight.toFixed(2),
      result.lastMile.toFixed(2),
      result.referralFee.toFixed(2),
      result.adCost.toFixed(2),
      result.storageOther.toFixed(2),
      result.returnLoss.toFixed(2),
    ];
    const csvContent =
      "data:text/csv;charset=utf-8," +
      headers.join(",") +
      "\n" +
      row.join(",");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute(
      "download",
      `cost_calc_${selectedBizCode}_${selectedSku}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isProfitable = result.netProfit >= 0;
  const isHealthyMargin = result.margin >= 0.15;

  return (
    <div className="space-y-6">
      {/* Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Net Profit */}
        <div className={`p-5 rounded-xl border ${isProfitable ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'} transition-all shadow-sm`}>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Net Profit (Unit)
          </div>
          <div className={`text-3xl font-bold ${isProfitable ? 'text-emerald-700' : 'text-rose-700'}`}>
            ${result.netProfit.toFixed(2)}
          </div>
        </div>

        {/* Margin */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Profit Margin
          </div>
          <div className={`text-3xl font-bold ${
            isHealthyMargin ? 'text-blue-600' : isProfitable ? 'text-orange-500' : 'text-rose-600'
          }`}>
            {(result.margin * 100).toFixed(2)}%
          </div>
        </div>

        {/* Efficiency */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Capital Efficiency
          </div>
          <div className="text-3xl font-bold text-slate-800">
            {result.capitalEfficiency.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Detail Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <h3 className="font-semibold text-slate-800 text-sm">Cost Breakdown</h3>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
             Last Mile: {result.sizeTier} / Charge Wt: {result.chargeWeight.toFixed(2)} kg
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-medium border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 font-semibold">Cost Item</th>
                <th className="px-5 py-3 font-semibold">Amount ($)</th>
                <th className="px-5 py-3 font-semibold">Ratio</th>
                <th className="px-5 py-3 font-semibold hidden sm:table-cell">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 font-medium text-slate-700">Product Cost</td>
                <td className="px-5 py-3 text-slate-900">${result.purchaseCost.toFixed(2)}</td>
                <td className="px-5 py-3 text-slate-500">{salePrice > 0 ? (result.purchaseCost / salePrice * 100).toFixed(1) + "%" : "-"}</td>
                <td className="px-5 py-3 text-xs text-slate-400 hidden sm:table-cell">From CSV</td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 font-medium text-slate-700">Head Freight</td>
                <td className="px-5 py-3 text-slate-900">${result.headFreight.toFixed(2)}</td>
                <td className="px-5 py-3 text-slate-500">{salePrice > 0 ? (result.headFreight / salePrice * 100).toFixed(1) + "%" : "-"}</td>
                <td className="px-5 py-3 text-xs text-slate-400 hidden sm:table-cell">{result.volumeCbm.toFixed(4)} CBM * Rate</td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 font-medium text-slate-700">Last Mile</td>
                <td className="px-5 py-3 text-slate-900">${result.lastMile.toFixed(2)}</td>
                <td className="px-5 py-3 text-slate-500">{salePrice > 0 ? (result.lastMile / salePrice * 100).toFixed(1) + "%" : "-"}</td>
                <td className="px-5 py-3 text-xs text-slate-400 hidden sm:table-cell">{currentCountry.lastMileRule}</td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 font-medium text-slate-700">Referral Fee</td>
                <td className="px-5 py-3 text-slate-900">${result.referralFee.toFixed(2)}</td>
                <td className="px-5 py-3 text-slate-500">{salePrice > 0 ? (result.referralFee / salePrice * 100).toFixed(1) + "%" : "-"}</td>
                <td className="px-5 py-3 text-xs text-slate-400 hidden sm:table-cell">{(currentCountry.referralFeeRate * 100).toFixed(1)}%</td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 font-medium text-slate-700">Storage / Misc</td>
                <td className="px-5 py-3 text-slate-900">${result.storageOther.toFixed(2)}</td>
                <td className="px-5 py-3 text-slate-500">{salePrice > 0 ? (result.storageOther / salePrice * 100).toFixed(1) + "%" : "-"}</td>
                <td className="px-5 py-3 text-xs text-slate-400 hidden sm:table-cell">{(currentCountry.storageOtherRate * 100).toFixed(1)}%</td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 font-medium text-slate-700">Advertising</td>
                <td className="px-5 py-3 text-orange-600 font-medium">${result.adCost.toFixed(2)}</td>
                <td className="px-5 py-3 text-slate-500">{salePrice > 0 ? (result.adCost / salePrice * 100).toFixed(1) + "%" : "-"}</td>
                <td className="px-5 py-3 text-xs text-slate-400 hidden sm:table-cell">Manual Rate</td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 font-medium text-slate-700">Return Loss</td>
                <td className="px-5 py-3 text-orange-600 font-medium">${result.returnLoss.toFixed(2)}</td>
                <td className="px-5 py-3 text-slate-500">{salePrice > 0 ? (result.returnLoss / salePrice * 100).toFixed(1) + "%" : "-"}</td>
                <td className="px-5 py-3 text-xs text-slate-400 hidden sm:table-cell">Rate: {(result.appliedReturnRate * 100).toFixed(1)}%</td>
              </tr>
              <tr className="bg-slate-50 border-t border-slate-200 font-bold text-slate-900">
                <td className="px-5 py-4">Total Cost</td>
                <td className="px-5 py-4">${result.totalCost.toFixed(2)}</td>
                <td className="px-5 py-4">{salePrice > 0 ? (result.totalCost / salePrice * 100).toFixed(1) + "%" : "-"}</td>
                <td className="px-5 py-4 hidden sm:table-cell"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleExport}
          disabled={!currentProduct}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export CSV
        </button>
      </div>
    </div>
  );
};

export default ResultSection;

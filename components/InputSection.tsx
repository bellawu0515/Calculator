import React, { ChangeEvent, useState } from 'react';
import { COUNTRY_CONFIGS } from '../constants';
import { ProductConfig, CountryConfig } from '../types';

interface InputSectionProps {
  productList: ProductConfig[];
  selectedBizCode: string;
  selectedSku: string;
  salePrice: number;
  adRate: number;
  overrideReturnRate: string;
  onBizCodeChange: (val: string) => void;
  onSkuChange: (val: string) => void;
  onSalePriceChange: (val: number) => void;
  onAdRateChange: (val: number) => void;
  onOverrideReturnRateChange: (val: string) => void;
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  currentProduct?: ProductConfig;
  currentCountry?: CountryConfig;
}

const InputSection: React.FC<InputSectionProps> = ({
  productList,
  selectedBizCode,
  selectedSku,
  salePrice,
  adRate,
  overrideReturnRate,
  onBizCodeChange,
  onSkuChange,
  onSalePriceChange,
  onAdRateChange,
  onOverrideReturnRateChange,
  onFileUpload,
  currentProduct,
  currentCountry
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-fit">
      <div className="bg-blue-50 px-5 py-3 border-b border-blue-100 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-700">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
        </svg>
        <span className="font-semibold text-blue-800 text-sm">Parameters</span>
      </div>
      
      <div className="p-5 space-y-5">
        
        {/* Market Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
            Market / Platform
          </label>
          <div className="relative">
            <select
              value={selectedBizCode}
              onChange={(e) => onBizCodeChange(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              {COUNTRY_CONFIGS.map((cfg) => (
                <option key={cfg.bizCode} value={cfg.bizCode}>
                  {cfg.bizCode} ({cfg.country} - {cfg.platform})
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>

        {/* Product Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
            Select SKU
          </label>
          <div className="relative">
            <select
              value={selectedSku}
              onChange={(e) => onSkuChange(e.target.value)}
              disabled={productList.length === 0}
              className={`w-full p-2.5 border rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                productList.length === 0 
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'bg-slate-50 border-slate-300 text-slate-800'
              }`}
            >
              {productList.length === 0 ? (
                <option>Upload CSV First</option>
              ) : (
                productList.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.name}
                  </option>
                ))
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>

          {currentProduct ? (
            <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1.5 text-slate-600">
              <div className="flex justify-between">
                <span>Cost (w/ Tax):</span>
                <span className="font-mono font-medium text-slate-900">${currentProduct.purchasePrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Dim:</span>
                <span className="font-mono">{currentProduct.lengthCm}x{currentProduct.widthCm}x{currentProduct.heightCm} cm</span>
              </div>
              <div className="flex justify-between">
                <span>Volume:</span>
                <span className="font-mono">{((currentProduct.lengthCm * currentProduct.widthCm * currentProduct.heightCm) / 1000000).toFixed(4)} CBM</span>
              </div>
              <div className="flex justify-between">
                <span>Weight:</span>
                <span className="font-mono">{currentProduct.weightKg} kg</span>
              </div>
            </div>
          ) : (
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 border-dashed rounded-lg text-xs text-slate-500 text-center">
              Upload product CSV to start
            </div>
          )}
        </div>

        {/* Pricing & Ads */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
              Target Price ($)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={salePrice}
              onChange={(e) => onSalePriceChange(parseFloat(e.target.value) || 0)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
              Ad Rate
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                max={1}
                min={0}
                value={adRate}
                onChange={(e) => onAdRateChange(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium">
                {(adRate * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
            Data Source
          </label>
          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg className="w-6 h-6 mb-2 text-slate-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
              </svg>
              <p className="text-xs text-slate-500"><span className="font-semibold text-blue-600">Click to upload CSV</span></p>
            </div>
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              onChange={onFileUpload} 
            />
          </label>
          <p className="mt-2 text-[10px] text-slate-400 leading-tight">
            Required Columns: SKU, Name, Purchase Price, Length, Width, Height, Gross Weight
          </p>
        </div>

        {/* Advanced Settings */}
        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          
          {showAdvanced && (
            <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">
                Override Return Rate (%)
              </label>
              <input
                type="number"
                placeholder={`Default: ${(currentCountry?.defaultReturnRate ?? 0) * 100}%`}
                value={overrideReturnRate}
                onChange={(e) => onOverrideReturnRateChange(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InputSection;

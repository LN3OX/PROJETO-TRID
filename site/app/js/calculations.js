(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProjetoTridCalculations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function printDurationHours(value) {
    const match = /^(\d{2}):([0-5]\d)$/.exec(String(value || ''));
    return match ? (Number(match[1]) * 60 + Number(match[2])) / 60 : NaN;
  }
  // Aceita horas decimais do fatiador ("3,7" ou "3.7" = 3h42) e devolve "HH:MM"; vazio se inválido.
  function decimalToHHMM(value) {
    const h = Number(String(value || '').trim().replace(',', '.'));
    if (!Number.isFinite(h) || h <= 0 || h >= 100) return '';
    const total = Math.round(h * 60), p = n => String(n).padStart(2, '0');
    return `${p(Math.floor(total / 60))}:${p(total % 60)}`;
  }
  function calculate(d) {
    const q = Math.max(1, Math.floor(Number(d.quantity) || 1));
    const amount = Number(d.amount) || 0;
    const packQty = Math.max(.01, Number(d.packQty) || .01);
    const waste = Math.min(300, Number(d.waste) || 0) / 100;
    const fail = Math.min(80, Number(d.failure) || 0) / 100;
    const material = amount * (1 + waste) * (Number(d.packPrice) || 0) / packQty * q;
    const hours = printDurationHours(d.printHours);
    const energy = (Number(d.power) || 0) / 1000 * hours * (Number(d.energyRate) || 0) * q;
    const machine = hours * ((Number(d.printerCost) || 0) / Math.max(1, Number(d.lifeHours) || 1) + (Number(d.maintenance) || 0)) * q;
    const labor = ((Number(d.setupMin) || 0) + (Number(d.finishMin) || 0) * q) / 60 * (Number(d.laborRate) || 0);
    const packaging = Number(d.packaging) || 0;
    const production = material + energy + machine + labor;
    const failureCost = fail > 0 ? production * fail / (1 - fail) : 0;
    const cost = production + failureCost + packaging;
    const feeRate = ((Number(d.salesFee) || 0) + (Number(d.taxRate) || 0)) / 100;
    const denominator = 1 - feeRate;
    const markup = (Number(d.margin) || 0) / 100;
    if (!Number.isFinite(hours) || denominator <= 0) return null;
    const price = cost * (1 + markup) / denominator;
    const unitPrice = Math.round(price / q * 100) / 100;
    const finalPrice = unitPrice * q;
    const fees = finalPrice * feeRate;
    const profit = finalPrice - fees - cost;
    return { q, material, energy, machine, labor, packaging, failureCost, cost, fees, profit, price: finalPrice, unitPrice };
  }
  return { calculate, printDurationHours, decimalToHHMM };
});

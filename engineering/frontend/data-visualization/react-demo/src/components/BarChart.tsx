import React from 'react';

export function BarChart({ data, width, height }) {
  const margin = {
    top: 20,
    right: 20,
    botoom: 30,
    left: 40,
  };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.botoom;

  const xScale = (i) => (i * innerWidth) / data.length;
  const yScale = (v) => innerHeight - (v / maxValue) * innerHeight;
  const maxValue = Math.max(...data.map((d) => d.value));


  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Bar chart">
      <g transform={`translate(${margin.left},${margin.top})`}>
        {data.map((d, i) => (
          <rect
            key={d.label}
            x={xScale(i) + 5}
            y={yScale(d.value)}
            width={innerWidth / data.length - 10}
            height={innerHeight - yScale(d.value)}
            fill={d.color}
          >
            <title>{`${d.label}: ${d.value}`}</title>
          </rect>
        ))}
      </g>
    </ svg>
  )
}
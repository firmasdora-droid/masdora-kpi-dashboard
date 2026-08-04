export interface ChartDatum {
  code: string;
  label: string;
  value: number;
  color: string;
}

export interface SeriesDatum {
  code: string;
  label: string;
  color: string;
  values: (number | null)[];
}

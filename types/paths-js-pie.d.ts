declare module 'paths-js/pie' {
  type PieDatum = Record<string, unknown>;

  type PieCurve<T = PieDatum> = {
    sector: {
      path: { print: () => string };
      centroid: [number, number];
    };
    item: T;
    index: number;
  };

  type PieOptions<T = PieDatum> = {
    center: [number, number];
    r: number;
    R: number;
    data: T[];
    accessor: (x: T) => number;
  };

  export default function Pie<T = PieDatum>(
    opts: PieOptions<T>
  ): { curves: PieCurve<T>[] };
}

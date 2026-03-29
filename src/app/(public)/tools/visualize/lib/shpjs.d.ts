declare module "shpjs" {
  export default function shp(buffer: ArrayBuffer): Promise<GeoJSON.FeatureCollection | GeoJSON.FeatureCollection[]>;
}

import { View } from "react-native";

const MapView = (props) => <View {...props} />;
MapView.Animated = (props) => <View {...props} />;

export default MapView;
export const Marker = (props) => <View {...props} />;
export const Polyline = () => null;
export const Polygon = () => null;
export const Circle = () => null;
export const Callout = (props) => <View {...props} />;
export const CalloutSubview = (props) => <View {...props} />;
export const Overlay = () => null;
export const Heatmap = () => null;
export const AnimatedRegion = class {
  constructor(region) { Object.assign(this, region); }
};
export const PROVIDER_GOOGLE = "google";
export const PROVIDER_DEFAULT = null;

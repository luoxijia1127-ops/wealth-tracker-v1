import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

export default function Dashboard() {
  const [netWorth, setNetWorth] = useState(0);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      const storedAssets = await AsyncStorage.getItem("assets");

      if (storedAssets) {
        const assets = JSON.parse(storedAssets);

        let total = 0;

        assets.forEach((asset: { shares: number; price: number; value: number; }) => {
          if (asset.shares && asset.price) {
            total += asset.shares * asset.price;
          } else if (asset.value) {
            total += asset.value;
          }
        });

        setNetWorth(total);
      }
    } catch (error) {
      console.log("Error loading assets:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Net Worth</Text>
      <Text style={styles.value}>${netWorth}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    fontSize: 24,
    marginBottom: 10,
  },
  value: {
    fontSize: 40,
    fontWeight: "bold",
  },
});
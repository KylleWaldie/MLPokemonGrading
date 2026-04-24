import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' }, // hide tab bar since we only need one screen
      }}
    >
      <Tabs.Screen name="index" />
    </Tabs>
  );
}
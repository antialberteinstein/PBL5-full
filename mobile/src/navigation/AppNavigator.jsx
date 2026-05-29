import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "../screens/Login";
import DashboardScreen from "../screens/Dashboard";
import FaceRegistrationScreen from "../screens/FaceRegistration";
import ClassDetailScreen from "../screens/ClassDetail";
import ProfileScreen from "../screens/Profile";

import { homeRouteForRole, isAuthenticated, getRole } from "../utils/auth";
import { setNavigationRef } from "../services/api";

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

export default function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState(null);
  const ready = useRef(false);

  useEffect(() => {
    (async () => {
      const authed = await isAuthenticated();
      if (!authed) {
        setInitialRoute("Login");
        return;
      }
      const role = await getRole();
      setInitialRoute(homeRouteForRole(role));
    })();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        if (!ready.current) {
          setNavigationRef(navigationRef);
          ready.current = true;
        }
      }}
    >
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerStyle: { backgroundColor: "#4f46e5" },
          headerTintColor: "#ffffff",
          headerTitleStyle: { fontWeight: "700" },
        }}
      >
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ title: "Lớp của tôi", headerBackVisible: false }}
        />
        <Stack.Screen
          name="FaceRegistration"
          component={FaceRegistrationScreen}
          options={{ title: "Đăng ký khuôn mặt" }}
        />
        <Stack.Screen
          name="ClassDetail"
          component={ClassDetailScreen}
          options={{ title: "Chi tiết lớp" }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: "Hồ sơ" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

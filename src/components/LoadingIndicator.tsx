import { View, ActivityIndicator, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'transparent',
  },
});

export const LoadingIndicator = () => (
  <View style={styles.centered}>
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#000" />
    </View>
  </View>
);

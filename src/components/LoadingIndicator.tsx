import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

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

export const LoadingIndicator = () => {
  const { colors } = useTheme();
  return (
    <View style={styles.centered}>
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    </View>
  );
};

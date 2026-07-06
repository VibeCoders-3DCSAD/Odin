import { Text, View } from "react-native";

type ShellPlaceholderPageProps = {
  title: string;
  subtitle: string;
};

export default function ShellPlaceholderPage({ title, subtitle }: ShellPlaceholderPageProps) {
  return (
    <View>
      <Text className="text-[#1B1C1A] text-xl font-semibold tracking-tight mb-1">{title}</Text>
      <Text className="text-[#414942] text-xs font-light mb-5">{subtitle}</Text>
      <View className="bg-[#F1F0EB] rounded-[1.75rem] h-[400px] items-center justify-center">
        <Text className="text-[#414942] text-sm">{title} — coming soon</Text>
      </View>
    </View>
  );
}

import { Text, View } from "react-native";

type ShellPlaceholderPageProps = {
  title: string;
  subtitle: string;
};

export default function ShellPlaceholderPage({ title, subtitle }: ShellPlaceholderPageProps) {
  return (
    <View>
      <Text className="text-[#1b1c1a] text-xl font-semibold tracking-tight mb-1">{title}</Text>
      <Text className="text-[#414942] text-xs font-light mb-5">{subtitle}</Text>
      <View className="bg-[#f4f4f0] rounded-[1.75rem] h-[400px] items-center justify-center">
        <Text className="text-[#414942] text-sm">{title} — coming soon</Text>
      </View>
    </View>
  );
}

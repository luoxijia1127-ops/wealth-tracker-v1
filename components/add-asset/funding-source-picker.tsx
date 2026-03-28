/**
 * 新增资产：资金来源（人民币现金类）选项行，黄金与场内证券共用。
 */

import type { AddModalStyles } from '@/lib/modal-styles';
import type { SimpleAsset } from '@/types/asset';
import { Pressable, Text, View } from 'react-native';

export function FundingSourcePicker({
  hint,
  fundingSourceId,
  onSelectId,
  fundingOptions,
  styles,
}: {
  hint: string;
  fundingSourceId: string;
  onSelectId: (id: string) => void;
  fundingOptions: SimpleAsset[];
  styles: AddModalStyles;
}) {
  return (
    <>
      <Text style={styles.label}>资金来源（选填）</Text>
      <Text style={styles.hintMuted}>{hint}</Text>
      <View style={styles.optionsRow}>
        <Pressable
          style={[
            styles.option,
            fundingSourceId === '' && styles.optionSelected,
          ]}
          onPress={() => onSelectId('')}
        >
          <Text
            style={[
              styles.optionText,
              fundingSourceId === '' && styles.optionTextSelected,
            ]}
          >
            不扣减
          </Text>
        </Pressable>
        {fundingOptions.slice(0, 6).map((fo) => (
          <Pressable
            key={fo.id}
            style={[
              styles.option,
              fundingSourceId === fo.id && styles.optionSelected,
            ]}
            onPress={() => onSelectId(fo.id)}
          >
            <Text
              style={[
                styles.optionText,
                fundingSourceId === fo.id && styles.optionTextSelected,
              ]}
              numberOfLines={1}
            >
              {fo.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

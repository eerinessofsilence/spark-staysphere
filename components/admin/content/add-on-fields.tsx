'use client';

import type { AddOn } from '@/lib/domain/schemas';
import type { MediaAsset } from '@/lib/domain/ports';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { lAddOnCategory, lPricingUnit } from '@/lib/i18n/format';
import { Switch } from '@/components/ui/switch';
import { AddOnNameField } from './add-on-name-field';
import { Field, Select, TextArea, TextInput } from './fields';
import { PhotoListEditor } from './photo-list-editor';

const CATEGORIES: AddOn['category'][] = ['service', 'dining'];
const PRICING_UNITS: AddOn['pricingUnit'][] = ['per_stay', 'per_night', 'per_guest'];

export interface AddOnFormValues {
  name: string;
  description: string;
  category: AddOn['category'];
  parentId?: string;
  photos: string[];
  price: number;
  pricingUnit: AddOn['pricingUnit'];
  enabled: boolean;
}

/**
 * The fields shared by "new add-on" and "edit add-on" — everything in
 * `addOnSchema` the CMS lets a team edit. `topLevelAddOns` excludes `ownId`
 * so an add-on can never be offered as its own parent. On an existing add-on
 * "On sale" is not a field: it sits in the page header and acts at once, the
 * same as the switch in the add-on list.
 *
 * A client component so it can read the team member's language: the
 * category and pricing-unit vocabularies come from the same `l*` formatters
 * the guest site uses.
 */
export function AddOnFields({
  initial,
  topLevelAddOns,
  assets,
  showOnSale = true,
}: {
  initial: AddOnFormValues;
  topLevelAddOns: AddOn[];
  assets: MediaAsset[];
  showOnSale?: boolean;
}) {
  const t = useAdminT();
  const locale = useAdminLocale();

  return (
    <div className="grid gap-6">
      <div role="group" aria-labelledby="addon-details-heading">
        <h2 id="addon-details-heading" className="text-base font-medium">
          {t('addOn.details')}
        </h2>
        <div className="mt-4 grid gap-4">
          <AddOnNameField initial={initial.name} />
          <Field id="addon-description" name="description" label={t('addOn.description')} hint={t('addOn.plainText')}>
            <TextArea id="addon-description" name="description" defaultValue={initial.description} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="addon-category" name="category" label={t('addOn.category')} hint={t('addOn.categoryHint')}>
              <Select id="addon-category" name="category" defaultValue={initial.category} required>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {lAddOnCategory(category, locale)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="addon-parentId" name="parentId" label={t('addOn.offeredInside')} hint={t('addOn.offeredInsideHint')}>
              <Select id="addon-parentId" name="parentId" defaultValue={initial.parentId ?? ''}>
                <option value="">{t('addOn.soldOnItsOwn')}</option>
                {topLevelAddOns.map((addOn) => (
                  <option key={addOn.id} value={addOn.id}>
                    {addOn.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </div>

      <div role="group" aria-labelledby="addon-pricing-heading">
        <h2 id="addon-pricing-heading" className="text-base font-medium">
          {t('addOn.pricing')}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{t('addOn.pricingNote')}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="addon-price" name="price" label={t('addOn.price')}>
            <TextInput id="addon-price" name="price" type="number" min={0} step="0.01" defaultValue={initial.price} required />
          </Field>
          <Field id="addon-pricingUnit" name="pricingUnit" label={t('addOn.charged')}>
            <Select id="addon-pricingUnit" name="pricingUnit" defaultValue={initial.pricingUnit} required>
              {PRICING_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {lPricingUnit(unit, locale)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {showOnSale ? (
          <label htmlFor="addon-enabled" className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <Switch id="addon-enabled" name="enabled" defaultChecked={initial.enabled} className="shrink-0" />
            {t('addOn.onSaleWhenCreated')}
          </label>
        ) : null}
      </div>

      <div role="group" aria-labelledby="addon-photos-heading">
        <h2 id="addon-photos-heading" className="text-base font-medium">
          {t('addOn.photos')}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{t('addOn.photosHint')}</p>
        <div className="mt-4">
          <PhotoListEditor name="photos" initial={initial.photos} assets={assets} />
        </div>
      </div>
    </div>
  );
}

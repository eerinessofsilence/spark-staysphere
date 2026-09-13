import type { AddOn } from '@/lib/domain/schemas';
import type { MediaAsset } from '@/lib/domain/ports';
import { Switch } from '@/components/ui/switch';
import { AddOnNameField } from './add-on-name-field';
import { Field, Select, TextArea, TextInput } from './fields';
import { PhotoListEditor } from './photo-list-editor';

const PRICING_UNIT_LABELS: Record<AddOn['pricingUnit'], string> = {
  per_stay: 'Per stay',
  per_night: 'Per night',
  per_guest: 'Per guest',
};

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
 * so an add-on can never be offered as its own parent.
 */
export function AddOnFields({
  initial,
  topLevelAddOns,
  assets,
}: {
  initial: AddOnFormValues;
  topLevelAddOns: AddOn[];
  assets: MediaAsset[];
}) {
  return (
    <div className="grid gap-6">
      <div role="group" aria-labelledby="addon-details-heading">
        <h2 id="addon-details-heading" className="text-base font-medium">
          Details
        </h2>
        <div className="mt-4 grid gap-4">
          <AddOnNameField initial={initial.name} />
          <Field id="addon-description" name="description" label="Description" hint="Plain text, no formatting.">
            <TextArea id="addon-description" name="description" defaultValue={initial.description} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="addon-category" name="category" label="Category" hint="Which counter it's sold from.">
              <Select id="addon-category" name="category" defaultValue={initial.category} required>
                <option value="service">Service</option>
                <option value="dining">Dining</option>
              </Select>
            </Field>
            <Field id="addon-parentId" name="parentId" label="Parent add-on" hint="Optional. Offered only inside its parent, one level deep.">
              <Select id="addon-parentId" name="parentId" defaultValue={initial.parentId ?? ''}>
                <option value="">None — a top-level add-on</option>
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
          Pricing
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Owned by the PMS or channel manager in production; the CMS only stores what to charge for the demo.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="addon-price" name="price" label="Price">
            <TextInput id="addon-price" name="price" type="number" min={0} step="0.01" defaultValue={initial.price} required />
          </Field>
          <Field id="addon-pricingUnit" name="pricingUnit" label="Charged">
            <Select id="addon-pricingUnit" name="pricingUnit" defaultValue={initial.pricingUnit} required>
              {Object.entries(PRICING_UNIT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <label htmlFor="addon-enabled" className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <Switch id="addon-enabled" name="enabled" defaultChecked={initial.enabled} className="shrink-0" />
          On sale
        </label>
      </div>

      <div role="group" aria-labelledby="addon-photos-heading">
        <h2 id="addon-photos-heading" className="text-base font-medium">
          Photos
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">A dish is chosen by sight; a service is shown by name only.</p>
        <div className="mt-4">
          <PhotoListEditor name="photos" initial={initial.photos} assets={assets} />
        </div>
      </div>
    </div>
  );
}

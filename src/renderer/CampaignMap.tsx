import type { Campaign } from '../domain/campaign';
import mapBackdrop from '../../assets/maps/age-of-reason-backdrop-concept-v1.png';
import { OperationalMap } from './OperationalMap';
import { useSession } from './session';

export function CampaignMap({ campaign }: { campaign: Campaign | null }) {
  const navigate = useSession((state) => state.navigate);
  if (campaign?.schemaVersion === 2)
    return <OperationalMap campaign={campaign} />;

  return (
    <section
      className="panel schematic-panel"
      aria-label="Campaign map preview"
    >
      <div className="section-heading">
        <h2>The Road to Fontenoy · 1745</h2>
        <span className="badge">Map preview</span>
      </div>
      <p>
        {campaign
          ? 'This campaign has no Fontenoy setup loaded. Review its setup to add the campaign grid, named locations and columns.'
          : 'Create or open a campaign to see its grid, named locations and columns on this backdrop.'}
      </p>
      <div className="map-scroll">
        <img
          className="map-backdrop-preview"
          src={mapBackdrop}
          width="1536"
          height="1024"
          alt="Age of Reason campaign backdrop with engraved countryside, waterways and a 1745 cartouche"
        />
      </div>
      <p className="save-caption">
        Generated decorative artwork. Illustrated towns, roads, rivers and
        terrain are not verified geography and do not define gameplay.
      </p>
      <div className="button-row">
        <button
          onClick={() => navigate(campaign ? 'Armies/Columns' : 'Dashboard')}
        >
          {campaign ? 'Review campaign setup' : 'Open campaign library'}
        </button>
      </div>
    </section>
  );
}

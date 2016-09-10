create index idx_d_date_date_id on d_date(date_id);
create index idx_d_date_year on d_date(year);
create index idx_d_date_yyyymm on d_date(yyyymm);
create index idx_d_date_date on d_date(date);

create index idx_d_ga_geo_geo_id on d_ga_geo(geo_id);
create index idx_d_ga_geo_contitent on d_ga_geo(continent);
create index idx_d_ga_geo_sub_contitent on d_ga_geo(sub_continent);
create index idx_d_ga_geo_country_code on d_ga_geo(country_code);

create index idx_d_country_country_id on d_country(country_id);
create index idx_d_country_country_code on d_country(country_code);

create index idx_d_ga_page_page_id on d_ga_page(page_id);
create index idx_d_ga_platform_platform_id on d_ga_platform(platform_id);
create index idx_d_ga_source_source_id on d_ga_source(source_id);

create index idx_f_ga_daily_date_id on f_ga_daily(date_id);
create index idx_f_ga_daily_source_id on f_ga_daily(source_id);
create index idx_f_ga_daily_geo_id on f_ga_daily(geo_id);
create index idx_f_ga_daily_page_id on f_ga_daily(page_id);

create index idx_f_facebook_daily_date_id on f_facebook_daily(date_id);
create index idx_f_twitter_daily_date_id on f_twitter_daily(date_id);
create index idx_f_youtube_daily_date_id on f_youtube_daily(date_id);

create index idx_f_mc_lists_daily_date_id on f_mc_lists_daily(date_id);
create index idx_f_mc_lists_daily_list_id on f_mc_lists_daily(list_id);
